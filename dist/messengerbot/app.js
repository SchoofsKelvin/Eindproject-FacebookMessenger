"use strict";
/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* jshint node: true, devel: true */
const bodyParser = require('body-parser');
const config = require('config');
const crypto = require('crypto');
const express = require('express');
const https = require('https');
const request = require('request');
const events = require('events');
const app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));
// Just a wrapper for the exports that allows events
class MessengerBot extends events.EventEmitter {
}
const bot = new MessengerBot();
/*
 * Be sure to setup your config values before running this code. You can
 * set them using environment variables or modifying the config file in /config.
 *
 */
// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
    process.env.MESSENGER_APP_SECRET :
    config.get('appSecret');
// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
    (process.env.MESSENGER_VALIDATION_TOKEN) :
    config.get('validationToken');
// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
    (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
    config.get('pageAccessToken');
// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ?
    (process.env.SERVER_URL) :
    config.get('serverURL');
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
    console.error('Missing config values');
    process.exit(1);
}
/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL.
 *
 */
app.get('/authorize', (req, res) => {
    const accountLinkingToken = req.query.account_linking_token;
    const redirectURI = req.query.redirect_uri;
    // Authorization Code should be generated per user by the developer. This will
    // be passed to the Account Linking callback.
    const authCode = '1234567890';
    // Redirect users to this URI on successful login
    const redirectURISuccess = `${redirectURI}&authorization_code=${authCode}`;
    res.render('authorize', {
        accountLinkingToken,
        redirectURI,
        redirectURISuccess,
    });
});
/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    const signature = req.headers['x-hub-signature'];
    if (!signature) {
        // For testing, let's log an error. In production, you should throw an
        // error.
        console.error("Couldn't validate the signature.");
    }
    else {
        const elements = signature.split('=');
        const method = elements[0];
        const signatureHash = elements[1];
        const expectedHash = crypto.createHmac('sha1', APP_SECRET)
            .update(buf)
            .digest('hex');
        if (signatureHash != expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
}
/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData,
    }, (error, response, body) => {
        if (!error && response.statusCode == 200) {
            const recipientId = body.recipient_id;
            const messageId = body.message_id;
            if (messageId) {
                // console.log('Successfully sent message with id %s to recipient %s', messageId, recipientId);
            }
            else {
                // console.log('Successfully called Send API for recipient %s', recipientId);
            }
        }
        else {
            console.error('Failed calling Send API', response.statusCode, response.statusMessage, body.error);
        }
    });
}
/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            text: messageText,
            metadata: 'DEVELOPER_DEFINED_METADATA',
        },
    };
    callSendAPI(messageData);
}
/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
    const senderID = event.sender.id;
    const recipientID = event.recipient.id;
    const timeOfAuth = event.timestamp;
    // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
    // The developer can set this to an arbitrary value to associate the
    // authentication callback with the 'Send to Messenger' click event. This is
    // a way to do account linking when the user clicks the 'Send to Messenger'
    // plugin.
    const passThroughParam = event.optin.ref;
    console.log('Received authentication for user %d and page %d with pass ' +
        "through param '%s' at %d", senderID, recipientID, passThroughParam, timeOfAuth);
    // When an authentication is received, we'll send a message back to the sender
    // to let them know it was successful.
    sendTextMessage(senderID, 'Authentication successful');
}
/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
    const senderID = event.sender.id;
    const recipientID = event.recipient.id;
    const delivery = event.delivery;
    const messageIDs = delivery.mids;
    const watermark = delivery.watermark;
    const sequenceNumber = delivery.seq;
    if (messageIDs) {
        messageIDs.forEach((messageID) => {
            console.log('Received delivery confirmation for message ID: %s', messageID);
        });
    }
    console.log('All message before %d were delivered.', watermark);
}
/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 *
 */
function receivedPostback(event) {
    const senderID = event.sender.id;
    const recipientID = event.recipient.id;
    const timeOfPostback = event.timestamp;
    // The 'payload' param is a developer-defined field which is set in a postback
    // button for Structured Messages.
    const payload = event.postback.payload;
    // console.log("Received postback for user %d and page %d with payload '%s' " +
    //   'at %d', senderID, recipientID, payload, timeOfPostback);
    bot.emit('postback', event);
    // When a postback is called, we'll send a message back to the sender to
    // let them know it was successful
    // sendTextMessage(senderID, 'Postback called');
}
/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 *
 */
function receivedMessageRead(event) {
    const senderID = event.sender.id;
    const recipientID = event.recipient.id;
    // All messages before watermark (a timestamp) or sequence have been seen.
    const watermark = event.read.watermark;
    const sequenceNumber = event.read.seq;
    console.log('Received message read event for watermark %d and sequence ' +
        'number %d', watermark, sequenceNumber);
}
/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 *
 */
function receivedAccountLink(event) {
    const senderID = event.sender.id;
    const recipientID = event.recipient.id;
    const status = event.account_linking.status;
    const authCode = event.account_linking.authorization_code;
    console.log('Received account link event with for user %d with status %s ' +
        'and auth code %s ', senderID, status, authCode);
}
/*
 * Pass Thread Control Event
 *
 * Part of the Handover Protocol
 * https://developers.facebook.com/docs/messenger-platform/handover-protocol/pass-thread-control
 *
 */
function receivePassThreadControl(event) {
    bot.emit('passThreadControl', event);
}
/*
 * Standby Event
 *
 * Part of the Handover Protocol
 * https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/standby
 *
 */
function receiveStandby(event) {
    bot.emit('standby', event);
}
/*
 * If users came here through testdrive, they need to configure the server URL
 * in default.json before they can access local resources likes images/videos.
 */
function requiresServerURL(next, [recipientId, ...args]) {
    if (SERVER_URL === 'to_be_set_manually') {
        const messageData = {
            recipient: {
                id: recipientId,
            },
            message: {
                text: `
We have static resources like images and videos available to test, but you need to update the code you downloaded earlier to tell us your current server url.
1. Stop your node server by typing ctrl-c
2. Paste the result you got from running "lt —port 5000" into your config/default.json file as the "serverURL".
3. Re-run "node app.js"
Once you've finished these steps, try typing “video” or “image”.
        `,
            },
        };
        callSendAPI(messageData);
    }
    else {
        next.apply(this, [recipientId, ...args]);
    }
}
function sendHiMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            text: `
Congrats on setting up your Messenger Bot!

Right now, your bot can only respond to a few words. Try out "quick reply", "typing on", "button", or "image" to see how they work. You'll find a complete list of these commands in the "app.js" file. Anything else you type will just be mirrored until you create additional commands.

For more details on how to create commands, go to https://developers.facebook.com/docs/messenger-platform/reference/send-api.
      `,
        },
    };
    callSendAPI(messageData);
}
/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'image',
                payload: {
                    url: `${SERVER_URL}/assets/rift.png`,
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'image',
                payload: {
                    url: `${SERVER_URL}/assets/instagram_logo.gif`,
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'audio',
                payload: {
                    url: `${SERVER_URL}/assets/sample.mp3`,
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'video',
                payload: {
                    url: `${SERVER_URL}/assets/allofus480.mov`,
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'file',
                payload: {
                    url: `${SERVER_URL}/assets/test.txt`,
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: 'This is test text',
                    buttons: [{
                            type: 'web_url',
                            url: 'https://www.oculus.com/en-us/rift/',
                            title: 'Open Web URL',
                        }, {
                            type: 'postback',
                            title: 'Trigger Postback',
                            payload: 'DEVELOPER_DEFINED_PAYLOAD',
                        }, {
                            type: 'phone_number',
                            title: 'Call Phone Number',
                            payload: '+16505551234',
                        }],
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [{
                            title: 'rift',
                            subtitle: 'Next-generation virtual reality',
                            item_url: 'https://www.oculus.com/en-us/rift/',
                            image_url: `${SERVER_URL}/assets/rift.png`,
                            buttons: [{
                                    type: 'web_url',
                                    url: 'https://www.oculus.com/en-us/rift/',
                                    title: 'Open Web URL',
                                }, {
                                    type: 'postback',
                                    title: 'Call Postback',
                                    payload: 'Payload for first bubble',
                                }],
                        }, {
                            title: 'touch',
                            subtitle: 'Your Hands, Now in VR',
                            item_url: 'https://www.oculus.com/en-us/touch/',
                            image_url: `${SERVER_URL}/assets/touch.png`,
                            buttons: [{
                                    type: 'web_url',
                                    url: 'https://www.oculus.com/en-us/touch/',
                                    title: 'Open Web URL',
                                }, {
                                    type: 'postback',
                                    title: 'Call Postback',
                                    payload: 'Payload for second bubble',
                                }],
                        }],
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
    // Generate a random receipt ID as the API requires a unique ID
    const receiptId = `order${Math.floor(Math.random() * 1000)}`;
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'receipt',
                    recipient_name: 'Peter Chang',
                    order_number: receiptId,
                    currency: 'USD',
                    payment_method: 'Visa 1234',
                    timestamp: '1428444852',
                    elements: [{
                            title: 'Oculus Rift',
                            subtitle: 'Includes: headset, sensor, remote',
                            quantity: 1,
                            price: 599.00,
                            currency: 'USD',
                            image_url: `${SERVER_URL}/assets/riftsq.png`,
                        }, {
                            title: 'Samsung Gear VR',
                            subtitle: 'Frost White',
                            quantity: 1,
                            price: 99.99,
                            currency: 'USD',
                            image_url: `${SERVER_URL}/assets/gearvrsq.png`,
                        }],
                    address: {
                        street_1: '1 Hacker Way',
                        street_2: '',
                        city: 'Menlo Park',
                        postal_code: '94025',
                        state: 'CA',
                        country: 'US',
                    },
                    summary: {
                        subtotal: 698.99,
                        shipping_cost: 20.00,
                        total_tax: 57.67,
                        total_cost: 626.66,
                    },
                    adjustments: [{
                            name: 'New Customer Discount',
                            amount: -50,
                        }, {
                            name: '$100 Off Coupon',
                            amount: -100,
                        }],
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            text: "What's your favorite movie genre?",
            quick_replies: [
                {
                    content_type: 'text',
                    title: 'Action',
                    payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION',
                },
                {
                    content_type: 'text',
                    title: 'Comedy',
                    payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY',
                },
                {
                    content_type: 'text',
                    title: 'Drama',
                    payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA',
                },
            ],
        },
    };
    callSendAPI(messageData);
}
/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
    console.log('Sending a read receipt to mark message as seen');
    const messageData = {
        recipient: {
            id: recipientId,
        },
        sender_action: 'mark_seen',
    };
    callSendAPI(messageData);
}
/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
    console.log('Turning typing indicator on');
    const messageData = {
        recipient: {
            id: recipientId,
        },
        sender_action: 'typing_on',
    };
    callSendAPI(messageData);
}
/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
    console.log('Turning typing indicator off');
    const messageData = {
        recipient: {
            id: recipientId,
        },
        sender_action: 'typing_off',
    };
    callSendAPI(messageData);
}
/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
    const messageData = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: 'Welcome. Link your account.',
                    buttons: [{
                            type: 'account_link',
                            url: `${SERVER_URL}/authorize`,
                        }],
                },
            },
        },
    };
    callSendAPI(messageData);
}
/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
    const senderID = event.sender.id;
    const recipientID = event.recipient.id;
    const timeOfMessage = event.timestamp;
    const message = event.message;
    // console.log(event);
    // console.log('Received message for user %d and page %d at %d with message:',
    //   senderID, recipientID, timeOfMessage);
    // console.log(JSON.stringify(message));
    const isEcho = message.is_echo;
    const messageId = message.mid;
    const appId = message.app_id;
    const metadata = message.metadata;
    // You may get a text or attachment but not both
    const messageText = message.text;
    const messageAttachments = message.attachments;
    const quickReply = message.quick_reply;
    if (isEcho) {
        // Just logging message echoes to console
        // console.log('Received echo for message %s and app %d with metadata %s', messageId, appId, metadata);
        return;
    }
    else if (quickReply) {
        const quickReplyPayload = quickReply.payload;
        // console.log('Quick reply for message %s with payload %s', messageId, quickReplyPayload);
        bot.emit('quickreply', event);
        // sendTextMessage(senderID, 'Quick reply tapped');
        return;
    }
    if (messageText) {
        bot.emit('message', event);
        if (event)
            return; // JUST NEED THE EVENT
        // If we receive a text message, check to see if it matches any special
        // keywords and send back the corresponding example. Otherwise, just echo
        // the text we received.
        switch (messageText.replace(/[^\w\s]/gi, '').trim().toLowerCase()) {
            case 'hello':
            case 'hi':
                sendHiMessage(senderID);
                break;
            case 'image':
                requiresServerURL(sendImageMessage, [senderID]);
                break;
            case 'gif':
                requiresServerURL(sendGifMessage, [senderID]);
                break;
            case 'audio':
                requiresServerURL(sendAudioMessage, [senderID]);
                break;
            case 'video':
                requiresServerURL(sendVideoMessage, [senderID]);
                break;
            case 'file':
                requiresServerURL(sendFileMessage, [senderID]);
                break;
            case 'button':
                sendButtonMessage(senderID);
                break;
            case 'generic':
                requiresServerURL(sendGenericMessage, [senderID]);
                break;
            case 'receipt':
                requiresServerURL(sendReceiptMessage, [senderID]);
                break;
            case 'quick reply':
                sendQuickReply(senderID);
                break;
            case 'read receipt':
                sendReadReceipt(senderID);
                break;
            case 'typing on':
                sendTypingOn(senderID);
                break;
            case 'typing off':
                sendTypingOff(senderID);
                break;
            case 'account linking':
                requiresServerURL(sendAccountLinking, [senderID]);
                break;
            default:
                sendTextMessage(senderID, messageText);
        }
    }
    else if (messageAttachments) {
        sendTextMessage(senderID, 'Message with attachment received');
    }
}
/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log('Validating webhook');
        res.status(200).send(req.query['hub.challenge']);
    }
    else {
        console.error('Failed validation. Make sure the validation tokens match.');
        res.sendStatus(403);
    }
});
/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', (req, res) => {
    const data = req.body;
    // console.log('DATA', JSON.stringify(data));
    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach((pageEntry) => {
            const pageID = pageEntry.id;
            const timeOfEvent = pageEntry.time;
            // Iterate over each messaging event
            if (pageEntry.messaging) {
                pageEntry.messaging.forEach((messagingEvent) => {
                    if (messagingEvent.optin) {
                        receivedAuthentication(messagingEvent);
                    }
                    else if (messagingEvent.message) {
                        receivedMessage(messagingEvent);
                    }
                    else if (messagingEvent.delivery) {
                        receivedDeliveryConfirmation(messagingEvent);
                    }
                    else if (messagingEvent.postback) {
                        receivedPostback(messagingEvent);
                    }
                    else if (messagingEvent.read) {
                        receivedMessageRead(messagingEvent);
                    }
                    else if (messagingEvent.account_linking) {
                        receivedAccountLink(messagingEvent);
                    }
                    else if (messagingEvent.pass_thread_control) {
                        receivePassThreadControl(messagingEvent);
                    }
                    else {
                        console.log('Webhook received unknown messagingEvent: ', messagingEvent);
                    }
                });
            }
            else if (pageEntry.standby) {
                pageEntry.standby.forEach(receiveStandby);
            }
            else {
                console.log('Webhook received unknown pageEntry: ', pageEntry);
            }
        });
        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});
// Start server
// Webhooks must be available via SSL with a certificate signed by a valid
// certificate authority.
app.listen(app.get('port'), () => {
    console.log('Node app is running on port', app.get('port'));
});
bot.app = app;
bot.callSendAPI = callSendAPI;
bot.MessengerBot = MessengerBot;
MessengerBot.app = app;
MessengerBot.callSendAPI = callSendAPI;
module.exports = bot;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbWVzc2VuZ2VyYm90L2FwcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7R0FPRztBQUVILG9DQUFvQztBQUVwQyxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDMUMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNqQyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkMsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQy9CLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNuQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFFakMsTUFBTSxHQUFHLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFDdEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUM7QUFDMUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDOUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzdELEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBRWxDLG9EQUFvRDtBQUNwRCxrQkFBbUIsU0FBUSxNQUFNLENBQUMsWUFBWTtDQUFHO0FBQ2pELE1BQU0sR0FBRyxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7QUFFL0I7Ozs7R0FJRztBQUVILHFEQUFxRDtB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