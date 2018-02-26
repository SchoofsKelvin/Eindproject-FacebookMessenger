
import { Conversation, IActivity, ICardAction, ICardHero, ICardHeroOrThumbnailContent, ICardImage, ICardThumbnail, INameAndId } from 'acvbotapi';

import { getProfile, handover as HandoverProtocol } from './fbapi';

import app = require('../messengerbot/app.js');
import { MessageWithText, PayloadGeneric } from '../messengerbot/app.js';
const MessengerBot = app.MessengerBot;
const bot = app as any as app.MessengerBot;

const callSendAPI = MessengerBot.callSendAPI;

const conversations: {[key: string]: Conversation} = {};
const passedToInbox: string[] = [];

/**
 * Helper function to send a simple text message
 */
function sendTextMessage(recipientId: string, message: string) {
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
function convertButtons(actions: ICardAction[]): app.Button[] {
  return actions.map((action) => {
    const url = action.type === 'openUrl';
    switch (action.type) {
      case 'openUrl':
        return {
          type: 'web_url',
          title: action.title || action.text,
          url: action.value,
        } as app.Button;
      case 'imBack':
        return {
          type: 'postback',
          title: action.title || action.text,
          payload: action.value || action.title,
        } as app.Button;
    }
  }).filter(e => e) as app.Button[];
}

/**
 * Gets the conversation for the given userId
 *
 * If none is known, one is created and its events are connected
 *
 * @param id The userId we want the conversation for
 */
async function getConversation(id: string) {
  let conv = conversations[id];
  if (conv) return conv;
  conv = conversations[id] = new Conversation();
  conv.userId = id;
  conv.userName = 'ID#' + id;
  const profile = await getProfile(id);
  conv.userName = `${profile.first_name} ${profile.last_name}`;
  conv.create();
  conv.on('message', (msg: string, act: IActivity) => {
    if (act.channelData && act.channelData.specialAction === 'livecontact') {
      console.log(`Switching conversation of ${conv.userName} to page inbox`);
      HandoverProtocol.passThreadControlToInbox(id, 'Initiated by bot activity');
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
        switch (attach.contentType as string) {
          case 'application/vnd.microsoft.card.hero': {
            const replies = (attach.content.buttons as ICardAction[]).map((button) => {
              return {
                content_type: 'text',
                title: button.title,
                image_url: button.image || null,
                payload: button.title,
              } as app.QuickReply;
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
            const attachment: app.Attachment = {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: [{
                  title: content.title as string,
                  image_url: (content.images as ICardImage[])[0].url,
                  buttons: convertButtons(content.buttons as ICardAction[]),
                }],
              } as PayloadGeneric,
            };
            console.log(`[To ${conv.userName}] ${attach.content.text || '...'}`);
            console.log('\tThumbnail: ' + JSON.stringify((attachment.payload as PayloadGeneric).elements));
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
async function handleMessageEvent(event: app.MessageEvent) {
  const conv = await getConversation(event.sender.id);
  let text = event.message && (event.message as MessageWithText).text;
  if (event.postback) {
    text = event.postback.payload || event.postback.title;
  } else if (event.message) {
    text = event.message.text;
    if (event.message.quick_reply) {
      text = event.message.quick_reply.payload || text;
    }
  }
  if (!text) return;
  if (text === 'helpcenter') { // Not really needed anymore, but keep for testing I guess
    console.log(`Switching conversation of ${conv.userName} to page inbox`);
    HandoverProtocol.passThreadControlToInbox(event.sender.id, 'User initiated');
    sendTextMessage(event.sender.id, '[ Welcome to the helpcenter ]');
    passedToInbox.push(event.sender.id);
    return;
  }
  console.log(`[From ${conv.userName}] ${text}`);
  conv.whenConnected(() => conv.sendMessage(text as string), 5000);
}

// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);

// Just for logging purposes for now
bot.on('passThreadControl', (event: app.MessageEvent) => {
  const conv = conversations[event.sender.id];
  if (!conv) return;
  // Bug: we forget if we passed it if the bot restarts
  //      Partially solving this by adding in standby
  if (!passedToInbox.includes(event.sender.id)) return;
  console.log(`Got thread control for ${conv.userName} (${conv.userId}) (${(event.pass_thread_control as any).metadata})`);
  sendTextMessage(event.sender.id, '[ Conversation returned to the bot ]');
});
bot.on('standby', async (event: app.MessageEvent) => {
  const conv = await getConversation(event.sender.id);
  // Fix that restart bug above
  if (!passedToInbox.includes(event.sender.id)) {
    console.log(`Marked ${conv.userName} (${conv.userId}) as passedToInbox from before a bot restart`);
    passedToInbox.push(event.sender.id);
  }
  // Just logging below
  let text = event.message && (event.message as MessageWithText).text;
  if (event.postback) {
    text = event.postback.payload || event.postback.title;
  } else if (event.message) {
    text = event.message.text;
    if (event.message.quick_reply) {
      text = event.message.quick_reply.payload || text;
    }
  }
  if (!text) return;
  console.log(`[STANDBY] [From ${conv.userName}] ${text}`);
});
