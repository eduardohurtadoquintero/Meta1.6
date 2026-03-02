// conflict-resolver.js - Estrategias de resolución de conflictos
export class ConflictResolver {

    async resolve(entityType, local, remote) {
        // ensure we always have objects to compare
        local = local || {};
        remote = remote || {};

        const strategies = {
            article: this.resolveArticle,
            review: this.resolveReview,
            assignment: this.resolveAssignment,
            user: this.resolveUser
        };

        const strategy = strategies[entityType] || this.resolveDefault;
        // call with this context in case the method needs it
        return strategy.call(this, local, remote);
    }

    resolveArticle(local, remote) {
        if (local.lastModified > remote.lastModified) {
            return {
                strategy: 'auto',
                merged: local,
                winner: 'local'
            };
        } else {
            return {
                strategy: 'auto',
                merged: remote,
                winner: 'remote'
            };
        }
    }

    resolveReview(local, remote) {
        const scores = {
            originality: Math.max(local.scores ? .originality || 0, remote.scores ? .originality || 0),
            methodology: Math.max(local.scores ? .methodology || 0, remote.scores ? .methodology || 0),
            results: Math.max(local.scores ? .results || 0, remote.scores ? .results || 0),
            writing: Math.max(local.scores ? .writing || 0, remote.scores ? .writing || 0)
        };

        const comments = [
            local.comments || '',
            '--- Versión local ---',
            remote.comments || '',
            '--- Versión remota ---'
        ].filter(Boolean).join('\n\n');

        const confidentialComments = (local.confidentialComments ? .length > remote.confidentialComments ? .length) ?
            local.confidentialComments :
            remote.confidentialComments;

        const recommendation = (local.lastModified > remote.lastModified) ?
            local.recommendation :
            remote.recommendation;

        const merged = {
            ...local,
            ...remote,
            scores,
            comments,
            confidentialComments,
            recommendation,
            version: Math.max(local.version, remote.version) + 1,
            merged: true
        };

        return {
            strategy: 'auto',
            merged
        };
    }

    resolveAssignment(local, remote) {
        return {
            strategy: 'auto',
            merged: remote,
            winner: 'remote'
        };
    }

    resolveUser(local, remote) {
        return {
            strategy: 'manual',
            local,
            remote,
            message: 'Conflicto en datos de usuario. Seleccione qué versión conservar.'
        };
    }

    resolveDefault(local, remote) {
        if (local.lastModified > remote.lastModified) {
            return {
                strategy: 'auto',
                merged: local,
                winner: 'local'
            };
        } else {
            return {
                strategy: 'auto',
                merged: remote,
                winner: 'remote'
            };
        }
    }
}