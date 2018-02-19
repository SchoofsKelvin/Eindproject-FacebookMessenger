
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
