"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const acvbotapi_1 = require("acvbotapi");
const fbapi_1 = require("./fbapi");
const app = require("../messengerbot/app.js");
const MessengerBot = app.MessengerBot;
const bot = app;
const callSendAPI = MessengerBot.callSendAPI;
const conversations = {};
/**
 * Helper function to send a simple text message
 */
function sendTextMessage(recipientId, message) {
    callSendAPI({
        messaging_type: 'RESPONSE',
        message: { text: message },
        recipient: { id: recipientId },
    });
}
/**
 * Converts CardActions to Buttons
 *
 * Only supports openUrl and imBack actions for now, other ones are filtered
 *
 * @param actions List of CardActions
 */
function convertButtons(actions) {
    return actions.map((action) => {
        const url = action.type === 'openUrl';
        switch (action.type) {
            case 'openUrl':
                return {
                    type: 'web_url',
                    title: action.title || action.text,
                    url: action.value,
                };
            case 'imBack':
                return {
                    type: 'postback',
                    title: action.title || action.text,
                    payload: action.value || action.title,
                };
        }
    }).filter(e => e);
}
/**
 * Gets the conversation for the given userId
 *
 * If none is known, one is created and its events are connected
 *
 * @param id The userId we want the conversation for
 */
function getConversation(id) {
    let conv = conversations[id];
    if (conv)
        return conv;
    conv = conversations[id] = new acvbotapi_1.Conversation();
    conv.userId = id;
    conv.userName = 'ID#' + id;
    fbapi_1.getProfile(id).then(p => conv.userName = `${p.first_name} ${p.last_name}`);
    conv.create();
    conv.on('message', (msg, act) => {
        if (msg) {
            sendTextMessage(id, msg);
            console.log(`[>${conv.userName}] ${msg}`);
        }
        if (act.attachments.length) {
            act.attachments.forEach((attach) => {
                switch (attach.contentType) {
                    case 'application/vnd.microsoft.card.hero': {
                        const replies = attach.content.buttons.map((button) => {
                            return {
                                content_type: 'text',
                                title: button.title,
                                image_url: button.image || null,
                                payload: button.title,
                            };
                        });
                        console.log(`[>${conv.userName}] ${attach.content.text || '...'}`);
                        console.log('\tQuick replies: ' + replies.map(r => r.title).join(', '));
                        callSendAPI({
                            message: {
                                quick_replies: replies,
                                text: attach.content.text || '...',
                            },
                            messaging_type: 'RESPONSE',
                            recipient: { id },
                        });
                        break;
                    }
                    case 'application/vnd.microsoft.card.thumbnail': {
                        const content = attach.content;
                        const attachment = {
                            type: 'template',
                            payload: {
                                template_type: 'generic',
                                elements: [{
                                        title: content.title,
                                        image_url: content.images[0].url,
                                        buttons: convertButtons(content.buttons),
                                    }],
                            },
                        };
                        console.log(`[>${conv.userName}] ${attach.content.text || '...'}`);
                        console.log('\tThumbnail: ' + JSON.stringify(attachment.payload.elements));
                        callSendAPI({
                            message: { attachment },
                            messaging_type: 'RESPONSE',
                            recipient: { id },
                        });
                        break;
                    }
                    default:
                        console.error(`No idea how to handle attachment type '${attach.contentType}'`, attach);
                }
            });
        }
    });
    return conv;
}
/**
 * Handles the MessageEvent from Messenger
 *
 * Uses getConversation(event.sender.id) internally, possibly starting a new conversation
 *
 * Basically extracts the text message (if possible) and sends it to the bot
 * First tries to extract postback payload/title, then quick_reply payload, then the regular message text
 * Also sets the conversation.userName to the first_name of {event.sender} if present
 *
 * @event event The MessageEvent we need to handle
 */
function handleMessageEvent(event) {
    const conv = getConversation(event.sender.id);
    let text = event.message && event.message.text;
    if (event.postback) {
        text = event.postback.payload || event.postback.title;
    }
    else if (event.message) {
        text = event.message.text;
        if (event.message.quick_reply) {
            text = event.message.quick_reply.payload || text;
        }
    }
    if (!text)
        return;
    console.log(`[<${conv.userName}] ${text}`);
    conv.whenConnected(() => conv.sendMessage(text), 5000);
}
// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2FjdmJvdGZiL2xpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBaUo7QUFFakosbUNBQXFDO0FBRXJDLDhDQUErQztBQUUvQyxNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQ3RDLE1BQU0sR0FBRyxHQUFHLEdBQThCLENBQUM7QUFFM0MsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLFdBQVcsQ0FBQztBQUU3QyxNQUFNLGFBQWEsR0FBa0MsRUFBRSxDQUFDO0FBRXhEOztHQUVHO0FBQ0gseUJBQXlCLFdBQW1CLEVBQUUsT0FBZTtJQUMzRCxXQUFXLENBQUM7UUFDVixjQUFjLEVBQUUsVUFBVTtRQUMxQixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO1FBQzFCLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUU7S0FDL0IsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILHdCQUF3QixPQUFzQjtJQUM1QyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQzVCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDO1FBQ3RDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLEtBQUssU0FBUztnQkFDWixNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLElBQUk7b0JBQ2xDLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSztpQkFDSixDQUFDO1lBQ2xCLEtBQUssUUFBUTtnQkFDWCxNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxJ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