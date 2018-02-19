"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    return __awaiter(this, void 0, void 0, function* () {
        let conv = conversations[id];
        if (conv)
            return conv;
        conv = conversations[id] = new acvbotapi_1.Conversation();
        conv.userId = id;
        conv.userName = 'ID#' + id;
        const profile = yield fbapi_1.getProfile(id);
        conv.userName = `${profile.first_name} ${profile.last_name}`;
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
    });
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
    return __awaiter(this, void 0, void 0, function* () {
        const conv = yield getConversation(event.sender.id);
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
    });
}
// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2FjdmJvdGZiL2xpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBLHlDQUFpSjtBQUVqSixtQ0FBcUM7QUFFckMsOENBQStDO0FBRS9DLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDdEMsTUFBTSxHQUFHLEdBQUcsR0FBOEIsQ0FBQztBQUUzQyxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBRTdDLE1BQU0sYUFBYSxHQUFrQyxFQUFFLENBQUM7QUFFeEQ7O0dBRUc7QUFDSCx5QkFBeUIsV0FBbUIsRUFBRSxPQUFlO0lBQzNELFdBQVcsQ0FBQztRQUNWLGNBQWMsRUFBRSxVQUFVO1FBQzFCLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7UUFDMUIsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRTtLQUMvQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsd0JBQXdCLE9BQXNCO0lBQzVDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDNUIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLENBQUM7UUFDdEMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDcEIsS0FBSyxTQUFTO2dCQUNaLE1BQU0sQ0FBQztvQkFDTCxJQUFJLEVBQUUsU0FBUztvQkFDZixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsSUFBSTtvQkFDbEMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLO2lCQUNKLENBQUM7WUFDbEIsS0FBSyxRQUFRO2dCQUNYLE1BQU0sQ0FBQztvQkFDTCxJQUFJLEVBQUUsVUFBVTtvQkFDaEIsS0FBSyxFQUFFLE1BQU0sQ0FB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