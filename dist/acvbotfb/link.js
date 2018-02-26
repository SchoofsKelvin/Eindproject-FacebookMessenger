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
const passedToInbox = [];
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
            if (act.channelData && act.channelData.specialAction === 'livecontact') {
                console.log(`Switching conversation of ${conv.userName} to page inbox`);
                fbapi_1.handover.passThreadControlToInbox(id, 'Initiated by bot activity');
                if (act.channelData.successMessage) {
                    sendTextMessage(id, act.channelData.successMessage);
                }
                passedToInbox.push(id);
                return; // Stop sending the default error message
            }
            if (msg) {
                sendTextMessage(id, msg);
                console.log(`[To ${conv.userName}] ${msg}`);
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
                            console.log(`[To ${conv.userName}] ${attach.content.text || '...'}`);
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
                            console.log(`[To ${conv.userName}] ${attach.content.text || '...'}`);
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
        if (text === 'helpcenter') {
            console.log(`Switching conversation of ${conv.userName} to page inbox`);
            fbapi_1.handover.passThreadControlToInbox(event.sender.id, 'User initiated');
            sendTextMessage(event.sender.id, '[ Welcome to the helpcenter ]');
            passedToInbox.push(event.sender.id);
            return;
        }
        console.log(`[From ${conv.userName}] ${text}`);
        conv.whenConnected(() => conv.sendMessage(text), 5000);
    });
}
// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);
// Just for logging purposes for now
bot.on('passThreadControl', (event) => {
    const conv = conversations[event.sender.id];
    if (!conv)
        return;
    // Bug: we forget if we passed it if the bot restarts
    //      Partially solving this by adding in standby
    if (!passedToInbox.includes(event.sender.id))
        return;
    console.log(`Got thread control for ${conv.userName} (${conv.userId}) (${event.pass_thread_control.metadata})`);
    sendTextMessage(event.sender.id, '[ Conversation returned to the bot ]');
});
bot.on('standby', (event) => __awaiter(this, void 0, void 0, function* () {
    const conv = yield getConversation(event.sender.id);
    // Fix that restart bug above
    if (!passedToInbox.includes(event.sender.id)) {
        console.log(`Marked ${conv.userName} (${conv.userId}) as passedToInbox from before a bot restart`);
        passedToInbox.push(event.sender.id);
    }
    // Just logging below
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
    console.log(`[STANDBY] [From ${conv.userName}] ${text}`);
}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2FjdmJvdGZiL2xpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBLHlDQUFpSjtBQUVqSixtQ0FBbUU7QUFFbkUsOENBQStDO0FBRS9DLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDdEMsTUFBTSxHQUFHLEdBQUcsR0FBOEIsQ0FBQztBQUUzQyxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBRTdDLE1BQU0sYUFBYSxHQUFrQyxFQUFFLENBQUM7QUFDeEQsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0FBRW5DOztHQUVHO0FBQ0gseUJBQXlCLFdBQW1CLEVBQUUsT0FBZTtJQUMzRCxXQUFXLENBQUM7UUFDVixjQUFjLEVBQUUsVUFBVTtRQUMxQixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO1FBQzFCLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUU7S0FDL0IsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILHdCQUF3QixPQUFzQjtJQUM1QyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQzVCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDO1FBQ3RDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLEtBQUssU0FBUztnQkFDWixNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLElBQUk7b0JBQ2xDLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSztpQkFDSixDQUFDO1lBQ2xCLEtBQUssUUFBUTtnQkFDWCxNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFF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