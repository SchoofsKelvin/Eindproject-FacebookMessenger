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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2FjdmJvdGZiL2xpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBLHlDQUFpSjtBQUVqSixtQ0FBbUU7QUFFbkUsOENBQStDO0FBRS9DLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDdEMsTUFBTSxHQUFHLEdBQUcsR0FBOEIsQ0FBQztBQUUzQyxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBRTdDLE1BQU0sYUFBYSxHQUFrQyxFQUFFLENBQUM7QUFDeEQsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0FBRW5DOztHQUVHO0FBQ0gseUJBQXlCLFdBQW1CLEVBQUUsT0FBZTtJQUMzRCxXQUFXLENBQUM7UUFDVixjQUFjLEVBQUUsVUFBVTtRQUMxQixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO1FBQzFCLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUU7S0FDL0IsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILHdCQUF3QixPQUFzQjtJQUM1QyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQzVCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDO1FBQ3RDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLEtBQUssU0FBUztnQkFDWixNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLElBQUk7b0JBQ2xDLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSztpQkFDSixDQUFDO1lBQ2xCLEtBQUssUUFBUTtnQkFDWCxNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxJQUFJLE1BQU0sQ0FBQyxJQUFJO29CQUNsQyxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsS0FBSztpQkFDeEIsQ0FBQztRQUNwQixDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFpQixDQUFDO0FBQ3BDLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCx5QkFBK0IsRUFBVTs7UUFDdkMsSUFBSSxJQUFJLEdBQUcsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzdCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxHQUFHLGFBQWEsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLHdCQUFZLEVBQUUsQ0FBQztRQUM5QyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDM0IsTUFBTSxPQUFPLEdBQUcsTUFBTSxrQkFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUM3RCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLEdBQVcsRUFBRSxHQUFjLEVBQUUsRUFBRTtZQUNqRCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNSLGVBQWUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ3pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsUUFBUSxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDOUMsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDM0IsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtvQkFDakMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLFdBQXFCLENBQUMsQ0FBQyxDQUFDO3dCQUNyQyxLQUFLLHFDQUFxQyxFQUFFLENBQUM7NEJBQzNDLE1BQU0sT0FBTyxHQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtnQ0FDdkUsTUFBTSxDQUFDO29DQUNMLFlBQVksRUFBRSxNQUFNO29DQUNwQixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUs7b0NBQ25CLFNBQVMsRUFBRSxNQUFNLENBQUMsS0FBSyxJQUFJLElBQUk7b0NBQy9CLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSztpQ0FDSixDQUFDOzRCQUN0QixDQUFDLENBQUMsQ0FBQzs0QkFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLFFBQVEsS0FBSyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDOzRCQUNyRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7NEJBQ3hFLFdBQVcsQ0FBQztnQ0FDVixPQUFPLEVBQUU7b0NBQ1AsYUFBYSxFQUFFLE9BQU87b0NBQ3RCLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxLQUFLO2lDQUNuQztnQ0FDRCxjQUFjLEVBQUUsVUFBVTtnQ0FDMUIsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFOzZCQUNsQixDQUFDLENBQUM7NEJBQ0gsS0FBSyxDQUFDO3dCQUNSLENBQUM7d0JBQ0QsS0FBSywwQ0FBMEMsRUFBRSxDQUFDOzRCQUNoRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDOzRCQUMvQixNQUFNLFVBQVUsR0FBbUI7Z0NBQ2pDLElBQUksRUFBRSxVQUFVO2dDQUNoQixPQUFPLEVBQUU7b0NBQ1AsYUFBYSxFQUFFLFNBQVM7b0NBQ3hCLFFBQVEsRUFBRSxDQUFDOzRDQUNULEtBQUssRUFBRSxPQUFPLENBQUMsS0FBZTs0Q0FDOUIsU0FBUyxFQUFHLE9BQU8sQ0FBQyxNQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7NENBQ2xELE9BQU8sRUFBRSxjQUFjLENBQUMsT0FBTyxDQUFDLE9BQXdCLENBQUM7eUNBQzFELENBQUM7aUNBQ2U7NkJBQ3BCLENBQUM7NEJBQ0YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxRQUFRLEtBQUssTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksS0FBSyxFQUFFLENBQUMsQ0FBQzs0QkFDckUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBRSxVQUFVLENBQUMsT0FBMEIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDOzRCQUMvRixXQUFXLENBQUM7Z0NBQ1YsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFO2dDQUN2QixjQUFjLEVBQUUsVUFBVTtnQ0FDMUIsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFOzZCQUNsQixDQUFDLENBQUM7NEJBQ0gsS0FBSyxDQUFDO3dCQUNSLENBQUM7d0JBQ0Q7NEJBQ0UsT0FBTyxDQUFDLEtBQUssQ0FBQywwQ0FBMEMsTUFBTSxDQUFDLFdBQVcsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUMzRixDQUFDO2dCQUNILENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7Q0FBQTtBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCw0QkFBa0MsS0FBdUI7O1FBQ3ZELE1BQU0sSUFBSSxHQUFHLE1BQU0sZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDcEQsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSyxLQUFLLENBQUMsT0FBMkIsQ0FBQyxJQUFJLENBQUM7UUFDcEUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDbkIsSUFBSSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO1FBQ3hELENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDekIsSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQzFCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDOUIsSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7WUFDbkQsQ0FBQztRQUNILENBQUM7UUFDRCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUFDLE1BQU0sQ0FBQztRQUNsQixFQUFFLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQztZQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixJQUFJLENBQUMsUUFBUSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3hFLGdCQUFnQixDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDN0UsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLCtCQUErQixDQUFDLENBQUM7WUFDbEUsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sQ0FBQztRQUNULENBQUM7UUFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFjLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNuRSxDQUFDO0NBQUE7QUFFRCwrREFBK0Q7QUFDL0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztBQUN0QyxHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3pDLEdBQUcsQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLGtCQUFrQixDQUFDLENBQUM7QUFFdkMsb0NBQW9DO0FBQ3BDLEdBQUcsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxLQUF1QixFQUFFLEVBQUU7SUFDdEQsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFBQyxNQUFNLENBQUM7SUFDbEIscURBQXFEO0lBQ3JELG1EQUFtRDtJQUNuRCxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUFDLE1BQU0sQ0FBQztJQUNyRCxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxNQUFNLE1BQU8sS0FBSyxDQUFDLG1CQUEyQixDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDekgsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLHNDQUFzQyxDQUFDLENBQUM7QUFDM0UsQ0FBQyxDQUFDLENBQUM7QUFDSCxHQUFHLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFPLEtBQXVCLEVBQUUsRUFBRTtJQUNsRCxNQUFNLElBQUksR0FBRyxNQUFNLGVBQWUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELDZCQUE2QjtJQUM3QixFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLE1BQU0sOENBQThDLENBQUMsQ0FBQztRQUNuRyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUNELHFCQUFxQjtJQUNyQixJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxJQUFLLEtBQUssQ0FBQyxPQUEyQixDQUFDLElBQUksQ0FBQztJQUNwRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNuQixJQUFJLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDeEQsQ0FBQztJQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUN6QixJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDMUIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzlCLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDO1FBQ25ELENBQUM7SUFDSCxDQUFDO0lBQ0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFBQyxNQUFNLENBQUM7SUFDbEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzNELENBQUMsQ0FBQSxDQUFDLENBQUMifQ==