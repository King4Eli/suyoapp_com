import express from 'express';
import { sessions } from '../global/functions.js';
import crypto from 'crypto';
import getChatsListings from './core/getChatLists.js';
import getConversation from './core/getConversation.js';
import getProfile from './core/getProfile.js';
import getLikes from './core/getLikes.js';
import pushLocation from './core/pushLocation.js';
import pushNewPhoneNumber from './core/pushNewPhonenumber.js';
import pushProfile from './core/pushProfile.js';
import getPeopleToMatch from './core/getPeopleToMatch.js';
import pushPeopleToMatch from './core/pushPeopleToMatch.js';
import pushConversation from './core/pushConversation.js';
import pushNewEmail from './core/pushNewEmail.js';
import pushLogReport from './core/pushLogReports.js';
import handleFileUpload from './core/handleFileUpload.js';
import getProducts from './core/getProducts.js';
import getPaymentHistory from './core/getPaymentHistory.js';
import getInterests from './core/getInterests.js';
import getPrompts from './core/getPrompts.js';
import getMapper from './core/getMapper.js';

const core_router = express.Router();
core_router.post('/:action', async (req, res) => {
    const { action } = req.params;
    if (!action) return res.status(201).json({ code: 201, message: "no action" });

    const headers = req.headers;
    const auth_token = Array.isArray(headers['x-omi-auth']) ? headers['x-omi-auth'][0] : (headers['x-omi-auth'] ?? "");
    const auth_hash = Array.isArray(headers['x-omi-hash']) ? headers['x-omi-hash'][0] : (headers['x-omi-hash'] ?? "");



    switch (action){
        case 'getMapper':
            const mapper = await getMapper();
            return res.json(mapper);
        case 'handleFileUpload':
            if (req.body?.meta?.bucketType === 'signup-void') {
                const fileResponse = await handleFileUpload(req.body?.meta);
                return res.json(fileResponse);
            }
            break;
        default:
            break;
    }

    const sessionValidation = sessions.verifyFullSession(auth_token, auth_hash);
    if (!sessionValidation.status) {
        return res.status(sessionValidation.code).json({ code: sessionValidation.code, message: sessionValidation.message });
    }

    switch (action) {
        case 'getChatLists':
            const chats = await getChatsListings();
            return res.json(chats);
        case 'getConversation':
            const matchID = req.body?.matchID;
            const convo = await getConversation(matchID);
            return res.json(convo);
        case 'getProfile':
            const profile = await getProfile();
            return res.json(profile);
        case 'getLikes':
            const likes = await getLikes();
            return res.json(likes);
        case 'getPeopleToMatch':
            const person = req.body?.getOnePersons_id2;
            const people = await getPeopleToMatch(person);
            return res.json(people);
        case 'getProducts':
            const products = await getProducts();
            return res.json(products);
        case 'getPaymentHistory':
            const paymentHistory = await getPaymentHistory();
            return res.json(paymentHistory);
        case 'getInterests':
            const interests = await getInterests();
            return res.json(interests);
        case 'getPrompts':
            const prompts = await getPrompts(req.body);
            return res.json(prompts);

            
        case 'pushConversation':
            const umatchid = req.body?.match_id;
            const textsms = req.body?.messagee;
            const filemeta = req.body?.file_meta;
            const uconvo = await pushConversation({
                match_id: umatchid,
                messagee: textsms,
                file_meta: filemeta
            });
            return res.json(uconvo);
        case 'pushPeopleToMatch':
            const upersonID = req.body?.user_id2;
            const umatchstatus = req.body?.match_status;
            const matchid = req.body?.matchId;
            const upeople = await pushPeopleToMatch({
                user_id2: upersonID,
                match_status: umatchstatus,
                matchId: matchid
            });
            return res.json(upeople);
        case 'pushLocation':
            const location_coords = req.body?.longlatd;
            const location = await pushLocation(location_coords);
            return res.json(location);
        case 'pushNewPhonenumber':
            const old_number = req.body?.oldpnumber;
            const new_number = req.body?.newpnumber;
            const vcode = req.body?.vcode;
            const rnc = req.body?.rnc; //request new code
            const number = await pushNewPhoneNumber(old_number, new_number, rnc, vcode);
            return res.json(number);
        case 'pushNewEmail':
            const old_email = req.body?.oldemail;
            const new_email = req.body?.newemail;
            const uvcode = req.body?.vcode;
            const urnc = req.body?.rnc; //request new code
            const email = await pushNewEmail(old_email, new_email, urnc, uvcode);
            return res.json(email);
        case 'pushProfile':
            const profileUpdates = req.body;
            const uprofile = await pushProfile(profileUpdates);
            return res.json(uprofile);
        case 'pushLogReport':
            const logvalue = req.body?.scripts;
            const log = await pushLogReport(logvalue, req.ip);
            return res.json({ code: 200, message: "logged" });

        case 'handleFileUpload':
            const meta = req.body?.meta;
            const fileResponse = await handleFileUpload(meta);
            return res.json(fileResponse);
        default:
            return res.status(400).json({ code: 400, message: "unresolved use case" });
    }
});
export default core_router;
