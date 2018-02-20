

import * as Express from 'express';
import { EventEmitter } from 'events';
import { type } from 'os';

export type ButtonUrl = {
    type: 'web_url';
    url: string;
    title?: string;
}
export type ButtonPostback = {
    type: 'postback';
    title: string;
    payload: string;
}
export type Button = ButtonUrl | ButtonPostback;

export type PayloadElement = {
    title: string;
    subtitle: string;
    image_url?: string;
    buttons?: Button[];
    default_action?: Button;
} | {
    title: string;
    subtitle?: string;
    image_url: string;
    buttons?: Button[];
    default_action?: Button;
} | {
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons: Button[];
    default_action?: Button;
};

export type PayloadGeneric = {
    template_type: 'generic';
    elements: PayloadElement[];
}
export type PayloadButton = {
    template_type: 'button';
    text?: string;
    buttons: Button[];
}
export type PayloadList = {
    template_type: 'list';
    top_element_style: 'large' | 'compact';
    elements: PayloadElement[],
    buttons: Button[],
}

export type Payload = PayloadGeneric | PayloadButton | PayloadList;

export interface Attachment {
    type: 'image' | 'audio' | 'video' | 'file' | 'template';
    payload: Payload;
}

export type QuickReply = {
    content_type: 'text' | 'location';
    title: string;
    image_url?: string;
    payload: string | number;
}

export type Recipient = {
    id: string,
    phone_number?: string,
    user_ref?: string,
    name?: {first_name: string, last_name: string}
}

export type MessageWithText = {
    text: string;
    quick_replies?: QuickReply[];
    metadata?: string;
}
export type MessageWithAttachment = {
    attachment: Attachment;
    quick_replies?: QuickReply[];
    metadata?: string;
}
export type Message = MessageWithText | MessageWithAttachment;

export type MessageType = 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG' | 'NON_PROMOTIONAL_SUBSCRIPTION';

export type MessageDataMessage = {
    messaging_type: MessageType;
    recipient: Recipient;
    notification_type?: 'REGULAR' | 'SILENT_PUSH' | 'NO_PUSH';
    tag?: string;
    message: Message;
}
export type MessageDataSenderAction = {
    messaging_type: MessageType;
    recipient: Recipient;
    notification_type?: 'REGULAR' | 'SILENT_PUSH' | 'NO_PUSH';
    tag?: string;
    sender_action: 'typing_on' | 'typing_off' | 'mark_seen';
}
export type MessageData = MessageDataMessage | MessageDataSenderAction;

export type MessageEvent = {
    sender: Recipient;
    recipient: Recipient;
    timestamp: number;
    message?: {
        mid: string;
        text: string;
        attachments: Attachment[];
        quick_reply?: {
            payload: string;
        }
    };
    postback?: {
        payload: string;
        title: string;
    };
    pass_thread_control?: {
        new_owner_app_id: string;
        metadata: string;
    };
    standby?: MessageEvent[];
}

export class MessengerBot extends EventEmitter {
    static app: Express.Application;
    static callSendAPI(messageData: MessageData): void;
}
