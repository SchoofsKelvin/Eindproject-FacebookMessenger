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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmJhcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9hY3Zib3RmYi9mYmFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsaUNBQWlDO0FBQ2pDLG1DQUFtQztBQUVuQyxNQUFNLGlCQUFpQixHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztJQUMzQyxNQUFNLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFFaEMsTUFBTSxNQUFNLEdBQUcseURBQXlELENBQUM7QUFZekUsb0JBQWlDLEVBQVU7O1FBQ3pDLE1BQU0sR0FBRyxHQUFHLG1DQUFtQyxFQUFFLFdBQVcsTUFBTSxpQkFBaUIsaUJBQWlCLEVBQUUsQ0FBQztRQUN2RyxNQUFNLENBQUMsSUFBSSxPQUFPLENBQW1CLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBVSxFQUFFLFFBQTBCLEVBQUUsSUFBUyxFQUFFLEVBQUU7Z0JBQ3JFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQztvQkFBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzlCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO2dCQUN6RyxPQUFPLENBQUMsSUFBd0IsQ0FBQyxDQUFDO1lBQ3BDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQUE7QUFWRCxnQ0FVQyJ9