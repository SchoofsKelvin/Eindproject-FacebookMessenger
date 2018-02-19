"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const acvbotapi_1 = require("acvbotapi");
const app = require("../node/app.js");
const MessengerBot = app.MessengerBot;
const bot = app;
const callSendAPI = MessengerBot.callSendAPI;
const conversations = {};
console.log('bot', bot);
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
    conv.create();
    conv.on('message', (msg, act) => {
        if (msg) {
            sendTextMessage(id, msg);
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
    conv.userName = event.sender.name ? event.sender.name.first_name : conv.userName;
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
    conv.whenConnected(() => conv.sendMessage(text), 5000);
}
// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2FjdmJvdGZiL2xpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBaUo7QUFFakosc0NBQXVDO0FBRXZDLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDdEMsTUFBTSxHQUFHLEdBQUcsR0FBOEIsQ0FBQztBQUUzQyxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBRTdDLE1BQU0sYUFBYSxHQUFrQyxFQUFFLENBQUM7QUFFeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFeEI7O0dBRUc7QUFDSCx5QkFBeUIsV0FBbUIsRUFBRSxPQUFlO0lBQzNELFdBQVcsQ0FBQztRQUNWLGNBQWMsRUFBRSxVQUFVO1FBQzFCLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7UUFDMUIsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRTtLQUMvQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsd0JBQXdCLE9BQXNCO0lBQzVDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDNUIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLENBQUM7UUFDdEMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDcEIsS0FBSyxTQUFTO2dCQUNaLE1BQU0sQ0FBQztvQkFDTCxJQUFJLEVBQUUsU0FBUztvQkFDZixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsSUFBSTtvQkFDbEMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLO2lCQUNKLENBQUM7WUFDbEIsS0FBSyxRQUFRO2dCQUNYLE1BQU0sQ0FBQztvQkFDTCxJQUFJLEVBQUUs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