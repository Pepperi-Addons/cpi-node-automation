import { PapiClient } from "@pepperi-addons/papi-sdk";
import { Client } from "@pepperi-addons/debug-server";
import fetch from "node-fetch";
import ClientActionBase from "../classes/clientActionsBase";
import ClientActionDialogTest from "../classes/clientActionsDialog";

class ClientActionsService {
  papiClient: PapiClient;

  constructor(private client: Client) {
    this.papiClient = new PapiClient({
      baseURL: client.BaseURL,
      token: client.OAuthAccessToken,
      addonSecretKey: client.AddonSecretKey,
      addonUUID: client.AddonUUID,
    });
  }

  async EmitEvent(webAPIBaseURL: string, accessToken: string, options) {
    //webapi.sandbox.pepperi.com/16.80.3/webapi/Service1.svc/v1/
    const URL = `${webAPIBaseURL}/Service1.svc/v1/EmitEvent`;
    const EmitEvent = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(options),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "application/json",
        },
      })
    ).json();
    return EmitEvent;
  }

  async EmitClientEvent(webAPIBaseURL: string, accessToken: string, options) {
    const map = global["map"] as Map<string, any>;
    let res = await this.EmitEvent(webAPIBaseURL, accessToken, options);
    const parsedActions = JSON.parse(res.Value);
    console.log(parsedActions);
    //stop condition -- if actions returns empty recurssion returns to the previous iteration
    if (Object.entries(parsedActions).length === 0) {
      return;
    } // note that the callback EmitEvent does not return any values;
    let action = (await this.generateClientAction(res)) as ClientActionBase;
    const parsedData = await this.parseActionDataForTest(action.Data);
    map.set(parsedData.Data.Actions[0].key, action.Data);
    const resTest = await action.Test(action.Data);
    let result = resTest.resObject;
    const testedOPtions = {
      EventKey: parsedActions.callback,
      EventData: JSON.stringify(result),
    };
    global["map"] = map;
    await this.EmitClientEvent(webAPIBaseURL, accessToken, testedOPtions);
  }

  async generateClientAction(data: any): Promise<ClientActionBase> {
    const Data = data;
    const value = JSON.parse(Data.Value);
    const actionType = value.Type;
    let action;
    switch (actionType) {
      case "Dialog":
        action = new ClientActionDialogTest(Data, actionType);
        break;

      default:
        break;
    }
    return action;
  }

  async parseActionDataForTest(Data: any) {
    const parsedData = JSON.parse(Data);
    const parsedValue = JSON.parse(parsedData.Value);
    return parsedValue;
  }
}

export default ClientActionsService;
