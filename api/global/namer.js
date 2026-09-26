// Redis key names. No imports, so scripts can use them without Stripe.
export const namer = {
  redis: {
    verifyCode: "verify:code:",
    products: "products:list",
    mapper: "mapper:lookup",
    streak: "streak:",
    streakReward: "streak:reward:",
  },
  ratelimit: {
    login_ip: "ratelimit:login:ip:",
    login_otp_request: "ratelimit:login:otp-request:",
    login_otp_verify: "ratelimit:login:otp-verify:",
    signup_ip: "ratelimit:signup:ip:",
    signup_otp_request: "ratelimit:signup:otp-request:",
    signup_otp_verify: "ratelimit:signup:otp-verify:",
    phonechange_otp_request: "ratelimit:phonechange:otp-request:",
    phonechange_otp_verify: "ratelimit:phonechange:otp-verify:",
    emailchange_otp_request: "ratelimit:emailchange:otp-request:",
    emailchange_otp_verify: "ratelimit:emailchange:otp-verify:",
    likes_daily: "ratelimit:likes:daily:",
    feed_post_daily: "ratelimit:feed:post:daily:",
  },
};
