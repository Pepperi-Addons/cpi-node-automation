import { PapiClient, FindOptions } from "@pepperi-addons/papi-sdk";
import { Client } from "@pepperi-addons/debug-server";
import fetch from "node-fetch";

export interface Script {
  Key: string;
  Hidden: boolean;
  CreationDateTime: string;
  ModificationDateTime: string;
  Description: string;
  Name: string;
  Code: string;
}

class ScriptService {
  papiClient: PapiClient;

  constructor(private client: Client) {
    this.papiClient = new PapiClient({
      baseURL: client.BaseURL,
      token: client.OAuthAccessToken,
      addonSecretKey: client.AddonSecretKey,
      addonUUID: client.AddonUUID,
    });
  }

  //POST {CPAS_BASE_URL}/addons/api/ADDONUUID/addon-cpi/:key/run
  //Body
  // {
  //     // the script params
  //     "Data": {}
  // }
  //results
  // {
  //     "Result": {}
  // }
  //function to run script via API
  async runScript(
    webAPIBaseURL: string,
    accessToken: string,
    scriptKey: string,
    Data: Object
  ) {
    //need fetch that will be replaced by papi.post once the url's will stabilize
    let URL = `${webAPIBaseURL}/Service1.svc/v1/Addons/Api/9f3b727c-e88c-4311-8ec4-3857bc8621f3/addon-cpi/${scriptKey}/run`;

    const scriptResults = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(Data),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "text/plain",
        },
      })
    ).json();

    return scriptResults;
  }
  //function to run script via function on this addons cpi-side (see scripts.service on cpi-side)
  async runCPISideScript(
    webAPIBaseURL: string,
    accessToken: string,
    scriptKey: string,
    Data: Object
  ) {
    let URL = `${webAPIBaseURL}/Service1.svc/v1/Addons/Api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/addon-cpi/runScript`;
    let body = {
      Key: scriptKey,
      Data: Data
    }
    const scriptResults = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "text/plain",
        },
      })
    ).json();

    return scriptResults;
  }
  //function to get all scripts
  async getAllScripts(): Promise<Script[]> {
    const res = await this.papiClient.get(
      `/addons/api/9f3b727c-e88c-4311-8ec4-3857bc8621f3/api/scripts`
    );
    return res;
  }
  //this gets scripts according to parameters,currently not optional due to it being cpi-meta-data
  async getScriptsWithFindOptions(findOptions: FindOptions): Promise<Script[]> {
    let url = `/addons/api/9f3b727c-e88c-4311-8ec4-3857bc8621f3/api/scripts?`;
    const obj = findOptions;
    for (const [key, value] of Object.entries(obj)) {
      url.includes("=")
        ? (url = url + `&${key}=${value.toString()}`)
        : (url = url + `${key}=${value.toString()}`);
    }
    const res = await this.papiClient.get(url);
    return res;
  }

  async getScriptByKey(key: string): Promise<Script> {
    //const res = this.papiClient.get()
    const res = await this.papiClient.get(
      `/addons/api/9f3b727c-e88c-4311-8ec4-3857bc8621f3/api/scripts?key=${key}`
    );
    return res;
  }
  //connect account in order to make sure the data is on the sqlite for this user
  async connectAccount(
    webAPIBaseURL: string,
    accessToken: string,
    uuid: string
  ) {
    const accountURL = `${webAPIBaseURL}/Service1.svc/v1/Account/${uuid}`;
    const accountReload = await (
      await fetch(accountURL, {
        method: "GET",
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "application/json",
        },
      })
    ).json();
    return accountReload;
  }
  //gets objects for clientAPI automation test
  async getTestDataObject() {
    const testObj = {
      itemUUID: "",
      activityUUID: "",
      transactionUUID: "",
      accountUUID: "",
      accountExID: "account" + Math.random(),
    };

    const accounts = await this.papiClient.accounts.find({
      where: `Name='Scripts Acc'`,
      page_size: 1,
    });
    testObj.accountUUID = accounts[0].UUID as string;

    const activities = await this.papiClient.activities.find({
      where: `Account.UUID='${testObj.accountUUID}'`,
      page_size: 1,
    });
    testObj.activityUUID = activities[0].UUID as string;

    const transactions = await this.papiClient.transactions.find({
      where: `Account.UUID='${testObj.accountUUID}'`,
      page_size: 1,
    });
    testObj.transactionUUID = transactions[0].UUID as string;

    const items = await this.papiClient.items.find({
      where: `ExternalID='Drug0001'`,
      page_size: 1,
    });
    testObj.itemUUID = items[0].UUID as string;

    return testObj;
  }
}

export default ScriptService;
