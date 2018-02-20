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
const config = require("config");
const request = require("request");
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
    (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
    config.get('pageAccessToken');
const FIELDS = 'first_name,last_name,profile_pic,locale,timezone,gender';
function getProfile(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://graph.facebook.com/v2.6/${id}?fields=${FIELDS}&access_token=${PAGE_ACCESS_TOKEN}`;
        return new Promise((resolve, reject) => {
            request.get(url, (error, response, body) => {
                if (error)
                    return console.error(error), reject(error);
                const data = JSON.parse(body);
                if (!data)
                    return console.log('Couldn\'t JSON parse data: ' + data), reject('Couldn\'t JSON parse data');
                resolve(data);
            });
        });
    });
}
exports.getProfile = getProfile;
function doPost(api, json) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://graph.facebook.com/v2.6/me/${api}?access_token=${PAGE_ACCESS_TOKEN}`;
        return new Promise((resolve, reject) => {
            request.post(url, { json }, (error, response, body) => {
                error ? (console.error(error), reject(error)) : resolve(body);
            });
        });
    });
}
exports.doPost = doPost;
exports.handover = {
    passThreadControl(recipientId, appId, metadata) {
        doPost('pass_thread_control', {
            metadata,
            recipient: { id: recipientId },
            target_app_id: appId,
        });
    },
    passThreadControlToInbox(recipientId, metadata) {
        exports.handover.passThreadControl(recipientId, '263902037430900', metadata);
    },
    takeThreadControl(recipientId, metadata) {
        doPost('take_thread_control', {
            metadata,
            recipient: { id: recipientId },
        });
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmJhcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9hY3Zib3RmYi9mYmFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsaUNBQWlDO0FBQ2pDLG1DQUFtQztBQUVuQyxNQUFNLGlCQUFpQixHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztJQUMzQyxNQUFNLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFFaEMsTUFBTSxNQUFNLEdBQUcseURBQXlELENBQUM7QUFZekUsb0JBQWlDLEVBQVU7O1FBQ3pDLE1BQU0sR0FBRyxHQUFHLG1DQUFtQyxFQUFFLFdBQVcsTUFBTSxpQkFBaUIsaUJBQWlCLEVBQUUsQ0FBQztRQUN2RyxNQUFNLENBQUMsSUFBSSxPQUFPLENBQW1CLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBVSxFQUFFLFFBQTBCLEVBQUUsSUFBUyxFQUFFLEVBQUU7Z0JBQ3JFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQztvQkFBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzlCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO2dCQUN6RyxPQUFPLENBQUMsSUFBd0IsQ0FBQyxDQUFDO1lBQ3BDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQUE7QUFWRCxnQ0FVQztBQUVELGdCQUE2QixHQUFXLEVBQUUsSUFBWTs7UUFDcEQsTUFBTSxHQUFHLEdBQUcsc0NBQXNDLEdBQUcsaUJBQWlCLGlCQUFpQixFQUFFLENBQUM7UUFDMUYsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFtQixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUN2RCxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsS0FBVSxFQUFFLFFBQTBCLEVBQUUsSUFBUyxFQUFFLEVBQUU7Z0JBQ2hGLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEUsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FBQTtBQVBELHdCQU9DO0FBRVksUUFBQSxRQUFRLEdBQUc7SUFDdEIsaUJBQWlCLENBQUMsV0FBbUIsRUFBRSxLQUFhLEVBQUUsUUFBaUI7UUFDckUsTUFBTSxDQUFDLHFCQUFxQixFQUFFO1lBQzVCLFFBQVE7WUFDUixTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFO1lBQzlCLGFBQWEsRUFBRSxLQUFLO1NBQ3JCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDRCx3QkFBd0IsQ0FBQyxXQUFtQixFQUFFLFFBQWlCO1FBQzdELGdCQUFRLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFDRCxpQkFBaUIsQ0FBQyxXQUFtQixFQUFFLFFBQWlCO1FBQ3RELE1BQU0sQ0FBQyxxQkFBcUIsRUFBRTtZQUM1QixRQUFRO1lBQ1IsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRTtTQUMvQixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0YsQ0FBQyJ9