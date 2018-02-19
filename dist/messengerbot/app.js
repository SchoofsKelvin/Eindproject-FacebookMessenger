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
    // console.log('DATA', data);
    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach((pageEntry) => {
            if (!pageEntry.messaging)
                return;
            const pageID = pageEntry.id;
            const timeOfEvent = pageEntry.time;
            // Iterate over each messaging event
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
                else {
                    console.log('Webhook received unknown messagingEvent: ', messagingEvent);
                }
            });
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