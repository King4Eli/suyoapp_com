import { _http_request } from '../functions';
import { __CONFIG__ } from '../static';

/**
 * Report a user, optionally in the context of a specific feed post they authored.
 * Moderation data -- lands in users_reported, not the generic app log stream.
 */
export const reportUser = async ({ reportedUserId, reportedPostId, reason }: {
    reportedUserId: string | undefined; reportedPostId?: string; reason: string;
}): Promise<boolean> => {
    if (!reportedUserId) return false;
    const response = await _http_request({
        reqType: 'POST',
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushReportUser',
        bodyArray: { reportedUserId, reportedPostId, reason },
    });
    return response?.code === 200;
};
