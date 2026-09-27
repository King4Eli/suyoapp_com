import express from "express";
import { sessions } from "../global/sessions.js";
import getChatsListings from "./core/getChatLists.js";
import getConversation from "./core/getConversation.js";
import getProfile from "./core/getProfile.js";
import getLikes from "./core/getLikes.js";
import pushLocation from "./core/pushLocation.js";
import pushNewPhoneNumber from "./core/pushNewPhonenumber.js";
import pushProfile from "./core/pushProfile.js";
import getPeopleToMatch from "./core/getPeopleToMatch.js";
import pushPeopleToMatch from "./core/pushPeopleToMatch.js";
import pushRewindMatch from "./core/pushRewindMatch.js";
import pushDirectMessage from "./core/pushDirectMessage.js";
import pushConversation from "./core/pushConversation.js";
import pushDeleteMessage from "./core/pushDeleteMessage.js";
import pushNewEmail from "./core/pushNewEmail.js";
import pushLogReport from "./core/pushLogReports.js";
import { checkRateLimit } from "../global/rateLimit.js";
import { namer } from "../global/namer.js";
import pushDevice from "./core/pushDevice.js";
import handleFileUpload from "./core/handleFileUpload.js";
import getProducts from "./core/getProducts.js";
import getPaymentHistory from "./core/getPaymentHistory.js";
import getPaymentStatus from "./core/getPaymentStatus.js";
import getPaymentNotices from "./core/getPaymentNotices.js";
import getBadgeCounts from "./core/getBadgeCounts.js";
import getConversationStarters from "./core/getConversationStarters.js";
import getVerification from "./core/getVerification.js";
import pushVerification from "./core/pushVerification.js";
import getInterests from "./core/getInterests.js";
import getPrompts from "./core/getPrompts.js";
import getReligions from "./core/getReligions.js";
import getMapper from "./core/getMapper.js";
import getEntitlement from "./core/getEntitlement.js";
import getFeed from "./core/getFeed.js";
import pushFeedPost from "./core/pushFeedPost.js";
import pushFeedReaction from "./core/pushFeedReaction.js";
import pushDeleteFeedPost from "./core/pushDeleteFeedPost.js";
import pushReportUser from "./core/pushReportUser.js";
import getFeedComments from "./core/getFeedComments.js";
import pushFeedComment from "./core/pushFeedComment.js";
import pushDeleteFeedComment from "./core/pushDeleteFeedComment.js";
import pushDeleteAccount from "./core/pushDeleteAccount.js";
import pushClaimStreakReward from "./core/pushClaimStreakReward.js";

// pushLogReport is open to signed-out clients, so it's throttled per IP instead.
const LOG_REQUESTS_PER_MINUTE = 60;

const core_router = express.Router();
core_router.post("/:action", async (req, res) => {
  const { action } = req.params;
  if (!action) return res.status(201).json({ code: 201, message: "no action" });

  const headers = req.headers;
  const auth_token = Array.isArray(headers["x-omi-auth"])
    ? headers["x-omi-auth"][0]
    : (headers["x-omi-auth"] ?? "");

  switch (action) {
    case "getMapper": {
      const mapper = await getMapper();
      return res.json(mapper);
    }
    case "pushLogReport": {
      // Logs aren't account-dependent: signed-out devices (signup/login errors)
      // must be able to report too. A valid session only decides attribution
      // (see pushLogReports.js); a missing/invalid one just leaves it empty.
      const logLimit = await checkRateLimit(
        `${namer.ratelimit.logs_ip}${req.ip}`,
        LOG_REQUESTS_PER_MINUTE,
        60,
      );
      if (!logLimit.allowed) {
        return res
          .status(429)
          .json({ code: 429, message: "Too many log reports." });
      }
      if (auth_token) sessions.verifyFullSession(auth_token);
      const logResp = await pushLogReport(req.body?.scripts, req.ip);
      // Reflect the real outcome so the client keeps failed logs queued for a
      // later retry instead of dropping them on a silent server-side failure.
      return res.status(logResp.code).json(logResp);
    }
    case "handleFileUpload": {
      if (req.body?.meta?.bucketType === "signup-void") {
        const fileResponse = await handleFileUpload(req.body?.meta);
        return res.json(fileResponse);
      }
      break;
    }
    default:
      break;
  }

  const sessionValidation = sessions.verifyFullSession(auth_token);
  if (!sessionValidation.status) {
    return res.status(sessionValidation.code).json({
      code: sessionValidation.code,
      message: sessionValidation.message,
    });
  }

  switch (action) {
    case "getChatLists": {
      const chats = await getChatsListings();
      return res.json(chats);
    }
    case "getConversation": {
      const matchID = req.body?.matchID;
      const convo = await getConversation(
        matchID,
        req.app.get("io"),
        req.body?.since,
      );
      return res.json(convo);
    }
    case "getProfile": {
      const profile = await getProfile();
      return res.json(profile);
    }
    case "getLikes": {
      const likes = await getLikes();
      return res.json(likes);
    }
    case "getPeopleToMatch": {
      const person = req.body?.getOnePersons_id2;
      const people = await getPeopleToMatch(person);
      return res.json(people);
    }
    case "getProducts": {
      const products = await getProducts();
      return res.json(products);
    }
    case "getPaymentHistory": {
      const paymentHistory = await getPaymentHistory();
      return res.json(paymentHistory);
    }
    case "getEntitlement": {
      const entitlement = await getEntitlement();
      return res.json(entitlement);
    }
    case "getInterests": {
      const interests = await getInterests();
      return res.json(interests);
    }
    case "getPrompts": {
      const prompts = await getPrompts(req.body);
      return res.json(prompts);
    }
    case "getReligions": {
      const religions = await getReligions();
      return res.json(religions);
    }
    case "getFeed": {
      const feedCursor = req.body?.cursor;
      const feedOnlyMine = req.body?.onlyMine === true;
      const feed = await getFeed({
        cursor: feedCursor,
        onlyMine: feedOnlyMine,
      });
      return res.json(feed);
    }

    case "pushConversation": {
      const umatchid = req.body?.match_id;
      const textsms = req.body?.messagee;
      const filemeta = req.body?.file_meta;
      const uconvo = await pushConversation(
        {
          match_id: umatchid,
          messagee: textsms,
          file_meta: filemeta,
        },
        req.app.get("io"),
      );
      return res.json(uconvo);
    }
    case "pushDeleteMessage": {
      const convoIdToDelete = req.body?.convoId;
      const deleteResult = await pushDeleteMessage(
        convoIdToDelete,
        req.app.get("io"),
      );
      return res.json(deleteResult);
    }
    case "pushPeopleToMatch": {
      const upersonID = req.body?.user_id2;
      const umatchstatus = req.body?.match_status;
      const matchid = req.body?.matchId;
      const upeople = await pushPeopleToMatch(
        {
          user_id2: upersonID,
          match_status: umatchstatus,
          matchId: matchid,
        },
        req.app.get("io"),
      );
      return res.json(upeople);
    }
    case "pushDirectMessage": {
      const direct = await pushDirectMessage(
        {
          user_id2: req.body?.user_id2,
          matchId: req.body?.matchId,
          message: req.body?.message,
          context: req.body?.context,
        },
        req.app.get("io"),
      );
      return res.json(direct);
    }
    case "getPaymentStatus": {
      const status = await getPaymentStatus({ paymentId: req.body?.paymentId });
      return res.json(status);
    }
    case "getVerification": {
      const verification = await getVerification();
      return res.json(verification);
    }
    case "pushVerification": {
      const submitted = await pushVerification({
        selfiePath: req.body?.selfiePath,
        pose: req.body?.pose,
      });
      return res.json(submitted);
    }
    case "getConversationStarters": {
      const starters = await getConversationStarters({
        matchId: req.body?.matchId,
      });
      return res.json(starters);
    }
    case "getBadgeCounts": {
      const badges = await getBadgeCounts();
      return res.json(badges);
    }
    case "getPaymentNotices": {
      const notices = await getPaymentNotices();
      return res.json(notices);
    }
    case "pushRewindMatch": {
      const rewound = await pushRewindMatch(
        { matchId: req.body?.matchId },
        req.app.get("io"),
      );
      return res.json(rewound);
    }
    case "pushFeedPost": {
      const feedCaption = req.body?.caption;
      const feedMedia = req.body?.media;
      const newPost = await pushFeedPost({
        caption: feedCaption,
        media: feedMedia,
      });
      return res.json(newPost);
    }
    case "pushFeedReaction": {
      const reactionPostId = req.body?.post_id;
      const reactionType = req.body?.reaction;
      const reactionResult = await pushFeedReaction({
        post_id: reactionPostId,
        reaction: reactionType,
      });
      return res.json(reactionResult);
    }
    case "pushDeleteFeedPost": {
      const deleteFeedPostId = req.body?.post_id;
      const deleteFeedPostResult = await pushDeleteFeedPost({
        post_id: deleteFeedPostId,
      });
      return res.json(deleteFeedPostResult);
    }
    case "pushReportUser": {
      const reportedUserId = req.body?.reportedUserId;
      const reportedPostId = req.body?.reportedPostId;
      const reportReason = req.body?.reason;
      const reportUserResult = await pushReportUser({
        reportedUserId,
        reportedPostId,
        reason: reportReason,
      });
      return res.json(reportUserResult);
    }
    case "pushClaimStreakReward": {
      const claimResult = await pushClaimStreakReward();
      return res.json(claimResult);
    }
    case "pushDeleteAccount": {
      const deleteAccountResult = await pushDeleteAccount({
        reason: req.body?.reason,
      });
      return res.json(deleteAccountResult);
    }
    case "getFeedComments": {
      const commentsPostId = req.body?.post_id;
      const comments = await getFeedComments({ post_id: commentsPostId });
      return res.json(comments);
    }
    case "pushFeedComment": {
      const newCommentPostId = req.body?.post_id;
      const newCommentText = req.body?.text;
      const newCommentParentId = req.body?.parent_id;
      const newComment = await pushFeedComment({
        post_id: newCommentPostId,
        text: newCommentText,
        parent_id: newCommentParentId,
      });
      return res.json(newComment);
    }
    case "pushDeleteFeedComment": {
      const deleteCommentId = req.body?.comment_id;
      const deleteCommentResult = await pushDeleteFeedComment({
        comment_id: deleteCommentId,
      });
      return res.json(deleteCommentResult);
    }
    case "pushLocation": {
      const location_coords = req.body?.longlatd;
      const location = await pushLocation(location_coords);
      return res.json(location);
    }
    case "pushNewPhonenumber": {
      const old_number = req.body?.oldpnumber;
      const new_number = req.body?.newpnumber;
      const vcode = req.body?.vcode;
      const rnc = req.body?.rnc; //request new code
      const number = await pushNewPhoneNumber(
        old_number,
        new_number,
        rnc,
        vcode,
      );
      return res.json(number);
    }
    case "pushNewEmail": {
      const old_email = req.body?.oldemail;
      const new_email = req.body?.newemail;
      const uvcode = req.body?.vcode;
      const urnc = req.body?.rnc; //request new code
      const email = await pushNewEmail(old_email, new_email, urnc, uvcode);
      return res.json(email);
    }
    case "pushProfile": {
      const profileUpdates = req.body;
      const uprofile = await pushProfile(profileUpdates);
      return res.json(uprofile);
    }
    case "pushDevice": {
      const deviceInfo = req.body?.device;
      const device = await pushDevice(deviceInfo);
      return res.json(device);
    }

    case "handleFileUpload": {
      const meta = req.body?.meta;
      const fileResponse = await handleFileUpload(meta);
      return res.json(fileResponse);
    }
    default:
      return res
        .status(400)
        .json({ code: 400, message: "unresolved use case" });
  }
});
export default core_router;
