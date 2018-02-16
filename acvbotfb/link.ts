
import { Conversation, IActivity, ICardAction, ICardHero, ICardHeroOrThumbnailContent, ICardImage, ICardThumbnail, INameAndId } from 'acvbotapi';

import app = require('../node/app.js');
import { MessageWithText } from '../node/app.js';
const MessengerBot = app.MessengerBot;
const bot = app as any as app.MessengerBot;

const callSendAPI = MessengerBot.callSendAPI;

const conversations: {[key: string]: Conversation} = {};

console.log('bot', bot);

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
function getConversation(id: string) {
  let conv = conversations[id];
  if (conv) return conv;
  conv = conversations[id] = new Conversation();
  conv.userId = id;
  conv.create();
  conv.on('message', (msg: string, act: IActivity) => {
    if (msg) {
      sendTextMessage(id, msg);
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
function handleMessageEvent(event: app.MessageEvent) {
  const conv = getConversation(event.sender.id);
  let text: string = event.message && (event.message as MessageWithText).text;
  conv.userName = event.sender.name ? event.sender.name.first_name : conv.userName;
  if (event.postback) {
    text = event.postback.payload || event.postback.title;
  } else if (event.message) {
    text = event.message.text;
    if (event.message.quick_reply) {
      text = event.message.quick_reply.payload || text;
    }
  }
  if (!text) return;
  conv.whenConnected(() => conv.sendMessage(text), 5000);
}

// We got one handler for messages, quick replies and postbacks
bot.on('message', handleMessageEvent);
bot.on('quickreply', handleMessageEvent);
bot.on('postback', handleMessageEvent);
