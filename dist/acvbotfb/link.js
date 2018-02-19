"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const acvbotapi_1 = require("acvbotapi");
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
    console.log(`[<${conv.userName}] ${text}`);
    conv.whenConnected(() => conv.sendMessage(text), 5000);
}
// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2FjdmJvdGZiL2xpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBaUo7QUFFakosOENBQStDO0FBRS9DLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDdEMsTUFBTSxHQUFHLEdBQUcsR0FBOEIsQ0FBQztBQUUzQyxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBRTdDLE1BQU0sYUFBYSxHQUFrQyxFQUFFLENBQUM7QUFFeEQ7O0dBRUc7QUFDSCx5QkFBeUIsV0FBbUIsRUFBRSxPQUFlO0lBQzNELFdBQVcsQ0FBQztRQUNWLGNBQWMsRUFBRSxVQUFVO1FBQzFCLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7UUFDMUIsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRTtLQUMvQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsd0JBQXdCLE9BQXNCO0lBQzVDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDNUIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLENBQUM7UUFDdEMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDcEIsS0FBSyxTQUFTO2dCQUNaLE1BQU0sQ0FBQztvQkFDTCxJQUFJLEVBQUUsU0FBUztvQkFDZixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsSUFBSTtvQkFDbEMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLO2lCQUNKLENBQUM7WUFDbEIsS0FBSyxRQUFRO2dCQUNYLE1BQU0sQ0FBQztvQkFDTCxJQUFJLEVBQUUsVUFBVTtvQkFDaEIsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFD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