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
                console.log('Successfully sent message with id %s to recipient %s', messageId, recipientId);
            }
            else {
                console.log('Successfully called Send API for recipient %s', recipientId);
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
    console.log("Received postback for user %d and page %d with payload '%s' " +
        'at %d', senderID, recipientID, payload, timeOfPostback);
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
    console.log(event);
    console.log('Received message for user %d and page %d at %d with message:', senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));
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
        console.log('Received echo for message %s and app %d with metadata %s', messageId, appId, metadata);
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
    console.log('DATA', data);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZS9hcHAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7O0dBT0c7QUFFSCxvQ0FBb0M7QUFFcEMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzFDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNqQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ25DLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMvQixNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRWpDLE1BQU0sR0FBRyxHQUFHLE9BQU8sRUFBRSxDQUFDO0FBQ3RCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDO0FBQzFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzlCLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM3RCxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUVsQyxvREFBb0Q7QUFDcEQsa0JBQW1CLFNBQVEsTUFBTSxDQUFDLFlBQVk7Q0FBRztBQUNqRCxNQUFNLEdBQUcsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDO0FBRS9COzs7O0dBSUc7QUFFSCxxREFBcUQ7QUFDckQsTUFB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