import { stripe_gateway, tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";


function normalizedDurationFunc(cycle = -1) { 
    // 1'once',2'weekly',3'biweekly',4'monthly',5'yearly',
    
     if (cycle === 3) {
        return {"name":"week","d": 2};
    } else if (cycle === 5) {
        return {"name":"year", "d": 1};
    } else if (cycle === 2) {
        return {"name":"week", "d": 1};
    } else if (cycle === 4) {
        return {"name":"month", "d": 1};
    }
    return null;
}
function normalizedPriceFunc(price = "") {
    // Remove any non-numeric characters except for the decimal point
    // convert to a float and then to cents (integer)
    // eg. "19.99" -> 1999, "$19.99" -> 1999, "19,99" -> 1999
    try {
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return null;
        }
        return Math.round(parsedPrice * 100); // Convert to cents
    } catch (e) {
        // @ts-ignore
        tools.serverLog(e?.message,"gateway-0")
        return null;
    }
}



export default class GatewayPay {
    static async subscribe(host = "", sku = "", sku_variant="", userEmail = "", productname = "", duration = -2, price = "", paymentId = "") {
        try {
            // Validate required parameters
            if (!host || !sku || !sku_variant || !userEmail || !productname || !duration || !price || !paymentId) {
                tools.serverLog(`Subscription missing required params: host=${host ? 'yes' : 'no'}, sku=${sku ? 'yes' : 'no'}, sku_variant=${sku_variant ? 'yes' : 'no'}, userEmail=${userEmail ? 'yes' : 'no'}, productname=${productname ? 'yes' : 'no'}, duration=${duration ? 'yes' : 'no'}, price=${price ? 'yes' : 'no'}, paymentId=${paymentId ? 'yes' : 'no'}`,'gateway-11');
                return {
                    code: 400,
                    message: "Missing required parameters for subscription creation."
                };
            }

            const normalizedPrice = normalizedPriceFunc(price);
            const normalizedDurationValue = normalizedDurationFunc(duration);

            if (!normalizedPrice) {
                tools.serverLog(`Subscription invalid price: ${price}`,'gateway-7');
                return {
                    code: 400,
                    message: "Invalid price format. Price must be a positive number."
                };
            }

            if (!normalizedDurationValue) {
                tools.serverLog(`Subscription invalid duration: ${duration}`,'gateway-6');
                return {
                    code: 400,
                    message: "Invalid duration. Supported: monthly, yearly, weekly, daily."
                };
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                tools.serverLog(`Subscription invalid email: ${userEmail}`,'gateway-8');
                return {
                    code: 400,
                    message: "Invalid email format."
                };
            }

            // Create Stripe checkout session with retry logic
            let session;
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // @ts-ignore
                    session = await stripe_gateway.checkout.sessions.create({
                        mode: "subscription",
                        payment_method_types: ['card', 'us_bank_account', 'cashapp'],
                        customer_email: userEmail,
                        line_items: [
                            {
                                price_data: {
                                    currency: "usd",
                                    product_data: {
                                        name: productname,
                                        metadata: {
                                            true_sku: sku,
                                            duration: duration,
                                            userId: sessions?.currentUserID
                                        }
                                    },
                                    unit_amount: normalizedPrice,
                                    recurring: {
                                        interval: normalizedDurationValue.name,
                                        interval_count: normalizedDurationValue.d
                                    }
                                },
                                quantity: 1
                            }
                        ],
                        success_url: "http://" + host + "/api/secure/gateway/success",
                        cancel_url: "http://" + host + "/api/secure/gateway/cancel",
                        metadata: {
                            userId: sessions?.currentUserID,
                            sku: sku,
                            sku_variant,
                            type: 'subscription',
                            paymentId
                        }
                    });
                    break; // Success, exit retry loop
                } catch (stripeError) {
                    tools.serverLog(`Stripe subscription attempt ${attempt} failed: ${stripeError}`,"gateway-2")
                     if (attempt === maxRetries) {
                        return {
                            code: 500,
                            // @ts-ignore
                            message: `Payment gateway error: ${stripeError.message || 'Unknown Stripe error'}`
                        };
                    }
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }

            if (!session || !session.url) {
                tools.serverLog(`Subscription created no session or URL: session=${Boolean(session)}, url=${session?.url ? 'yes' : 'no'}`,'gateway-1');
                return {
                    code: 500,
                    message: "Failed to create payment session."
                };
            }

            return {
                code: 301,
                type: "external",
                url: session.url
            };
        } catch (error) {
            tools.serverLog(`Unexpected error in subscription creation: ${error}`,"gateway-5");
            return {
                code: 500,
                // @ts-ignore
                message: error.message || 'An unexpected error occurred during subscription creation.'
            };
        }
    }

    static async onetime(host = "", sku = "", sku_variant="", userEmail = "", productname = "", duration = "", price = "", paymentId = "", matchId = "") {
        try {
            // Validate required parameters
            if (!host || !sku || !sku_variant || !userEmail || !productname || !price || !paymentId) {
                tools.serverLog(`One-time payment missing required params: host=${host ? 'yes' : 'no'}, sku=${sku ? 'yes' : 'no'}, sku_variant=${sku_variant ? 'yes' : 'no'}, userEmail=${userEmail ? 'yes' : 'no'}, productname=${productname ? 'yes' : 'no'}, price=${price ? 'yes' : 'no'}, paymentId=${paymentId ? 'yes' : 'no'}`,'gateway-0');
                return {
                    code: 400,
                    message: "Missing required parameters for one-time payment creation."
                };
            }

            const normalizedPrice = normalizedPriceFunc(price);

            if (!normalizedPrice) {
                tools.serverLog(`One-time payment invalid price: ${price}`,'gateway-0');
                return {
                    code: 400,
                    message: "Invalid price format. Price must be a positive number."
                };
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                tools.serverLog(`One-time payment invalid email: ${userEmail}`,'gateway-0');
                return {
                    code: 400,
                    message: "Invalid email format."
                };
            }

            // Create Stripe checkout session for one-time payment with retry logic
            let session;
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    session = await stripe_gateway.checkout.sessions.create({
                        mode: "payment",
                        payment_method_types: ['card', 'us_bank_account', 'cashapp'],
                        customer_email: userEmail,
                        line_items: [
                            {
                                price_data: {
                                    currency: "usd",
                                    product_data: {
                                        name: productname,
                                        metadata: {
                                            true_sku: sku,
                                            duration: duration,
                                            userId: sessions?.currentUserID
                                        }
                                    },
                                    unit_amount: normalizedPrice
                                },
                                quantity: 1
                            }
                        ],
                        success_url: "http://" + host + "/api/secure/gateway/success",
                        cancel_url: "http://" + host + "/api/secure/gateway/cancel",
                        metadata: {
                            userId: sessions?.currentUserID,
                            sku: sku,
                            sku_variant,
                            type: 'onetime',
                            paymentId,
                            ...(matchId ? { matchId } : {})
                        }
                    });
                    break; // Success, exit retry loop
                } catch (stripeError) {
                    tools.serverLog(`Stripe one-time payment attempt ${attempt} failed: ${stripeError}`,"gateway-0");
                    if (attempt === maxRetries) {
                        return {
                            code: 500,
                            // @ts-ignore
                            message: `Payment gateway error: ${stripeError.message || 'Unknown Stripe error'}`
                        };
                    }
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }

            if (!session || !session.url) {
                tools.serverLog(`One-time payment created no session or URL: session=${Boolean(session)}, url=${session?.url ? 'yes' : 'no'}`,'gateway-0');
                return {
                    code: 500,
                    message: "Failed to create payment session."
                };
            }

            return {
                code: 301,
                type: "external",
                url: session.url
            };
        } catch (error) {
            tools.serverLog(`Unexpected error in one-time payment creation: ${error}`,"gateway-0");
            return {
                code: 500,
                // @ts-ignore
                message: error.message || 'An unexpected error occurred during one-time payment creation.'
            };
        }
    }

}
