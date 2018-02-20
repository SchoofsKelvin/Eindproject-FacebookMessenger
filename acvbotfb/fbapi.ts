
import * as config from 'config';
import * as request from 'request';

const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

const FIELDS = 'first_name,last_name,profile_pic,locale,timezone,gender';

export interface IFacebookProfile {
  first_name: string;
  last_name: string;
  profile_pic: string;
  locale: string;
  timezone: number;
  gender: 'male' | 'female';
  id: string;
}

export async function getProfile(id: string): Promise<IFacebookProfile> {
  const url = `https://graph.facebook.com/v2.6/${id}?fields=${FIELDS}&access_token=${PAGE_ACCESS_TOKEN}`;
  return new Promise<IFacebookProfile>((resolve, reject) => {
    request.get(url, (error: any, response: request.Response, body: any) => {
      if (error) return console.error(error), reject(error);
      const data = JSON.parse(body);
      if (!data) return console.log('Couldn\'t JSON parse data: ' + data), reject('Couldn\'t JSON parse data');
      resolve(data as IFacebookProfile);
    });
  });
}

export async function doPost(api: string, json: object) {
  const url = `https://graph.facebook.com/v2.6/me/${api}?access_token=${PAGE_ACCESS_TOKEN}`;
  return new Promise<IFacebookProfile>((resolve, reject) => {
    request.post(url, { json }, (error: any, response: request.Response, body: any) => {
      error ? (console.error(error), reject(error)) : resolve(body);
    });
  });
}

export const handover = {
  passThreadControl(recipientId: string, appId: string, metadata?: string) {
    doPost('pass_thread_control', {
      metadata,
      recipient: { id: recipientId },
      target_app_id: appId,
    });
  },
  passThreadControlToInbox(recipientId: string, metadata?: string) {
    handover.passThreadControl(recipientId, '263902037430900', metadata);
  },
  takeThreadControl(recipientId: string, metadata?: string) {
    doPost('take_thread_control', {
      metadata,
      recipient: { id: recipientId },
    });
  },
};
