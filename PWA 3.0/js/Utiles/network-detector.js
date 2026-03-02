// network-detector.js - Detección avanzada de conectividad
export class NetworkDetector {
    static listeners = {
        online: [],
        offline: []
    };

    static isOnline = navigator.onLine;

    static init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline');
        });

        this.startConnectivityCheck();
    }

    static onOnline(callback) {
        this.listeners.online.push(callback);
    }

    static onOffline(callback) {
        this.listeners.offline.push(callback);
    }

    static notifyListeners(event) {
        this.listeners[event].forEach(cb => {
            try { cb(); } catch (e) { console.error(e); }
        });
    }

    static startConnectivityCheck() {
        setInterval(async() => {
            const wasOnline = this.isOnline;
            const isNowOnline = await this.checkRealConnectivity();

            if (wasOnline !== isNowOnline) {
                this.isOnline = isNowOnline;
                this.notifyListeners(isNowOnline ? 'online' : 'offline');
            }
        }, 30000);
    }

    static async checkRealConnectivity() {
        try {
            const response = await fetch('https://httpbin.org/status/200', {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            return true;
        } catch {
            return false;
        }
    }
}