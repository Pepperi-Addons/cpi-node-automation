import MyService from "./services/my.service";
import { Client, Request } from "@pepperi-addons/debug-server";
import Tester from "./tester";
import { AddonData, InstalledAddon } from "@pepperi-addons/papi-sdk";
import ScriptService, { Script } from "./services/scripts.service";
import ClientActionsService, {
  ClientAction,
} from "./services/clientActions.service";
import NotificationService, {
  userDevice,
  Notification,
} from "./services/notifications.service";
import SyncService from "./services/sync.service";
import fs from "fs";
import path from "path";
//note each test does two things on its start:
//1.gets webAPI AKA CPAS token
//2.gets webAPI AKA CPAS base url (changes between each env)

//==============================cpi-node======================================
/** Load function test endpoint */
export async function InitiateLoad(client: Client, request: Request) {
  //this test triggers the sync twice,every time the sync triggers the Load
  //function on cpi-side triggers, writes into udt on both runs and then checks sequence
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const { describe, it, expect, run } = Tester();

  if (isLocal) {
    accessToken = "cf721941-c8e8-4885-929c-fef4d1659fb9"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //set test flag to On
  const flagOn1 = await service.setTestFlag({
    TestRunCounter: 0,
    TestActive: true,
  }); // activates test
  await service.sleep(5000);
  const firstSync = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  const flagOn2 = await service.setTestFlag({
    TestRunCounter: 1,
    TestActive: true,
  }); // activates second iteration
  await service.sleep(5000);
  const secondSync = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //set test flag to Off
  const flagOff = await service.setTestFlag({
    TestRunCounter: 0,
    TestActive: false,
  }); // deactivates test
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(10000);
  //need to add mocha and UDT get
  const udtData = await service.getUDTValues("LoadUDT", 2, "DESC");
  // remove UDT lines after test
  for (const line of udtData) {
    try {
      const res = await service.updateUDTValues(
        line.MapDataExternalID,
        line.MainKey,
        line.SecondaryKey,
        true
      );
      console.log(
        `LoadTester::Updated UDTLineID ${line.InternalID},with the following hidden status: ${res.Hidden} `
      );
    } catch (err) {
      console.log(`LoadTester::UDT Removal error: ${err}`);
    }
  }

  //mocha test
  describe("Load function automation test", async () => {
    it("Parsed test results", async () => {
      debugger;
      expect(
        udtData,
        "There was an issue,only one record returned from the Load UDT"
      )
        .to.be.an("array")
        .that.has.lengthOf(2);

      expect(
        udtData[0].SecondaryKey,
        "UDT brought back the wrong value for the first Load write"
      )
        .to.be.a("string")
        .and.to.be.equal("1").and.that.is.not.null.and.that.is.not.undefined;

      expect(
        udtData[1].SecondaryKey,
        "UDT brought back the wrong value for the second Load write"
      ).to.be.equal("0").and.that.is.not.null.and.that.is.not.undefined;

      expect(
        udtData[0].MainKey,
        "Both UDT values were indentical,there is an issue with the Load/Sync"
      )
        .to.be.a("string")
        .and.not.to.be.equal(udtData[1].MainKey);
    });
  });
  const testResults = await run();
  return testResults;
}
/** AddonAPI & versions testing endpoint */
export async function AddonAPITester(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  // object to hold addon uuid and phased status -> for versions output
  const addonsKVP = [
    { uuid: "bb6ee826-1c6b-4a11-9758-40a46acb69c5", phased: false }, // cpi-node
    { uuid: "00000000-0000-0000-0000-0000003eba91", phased: true }, // cpas
    { uuid: "00000000-0000-0000-0000-000000000a91", phased: true }, // papi
    { uuid: "00000000-0000-0000-0000-000000abcdef", phased: true }, // cpapi
    { uuid: "00000000-0000-0000-0000-00000000ada1", phased: true }, // adal
    { uuid: "00000000-0000-0000-0000-000000040fa9", phased: true }, // pns
  ];
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  if (isLocal) {
    accessToken = "257ef28b-e2c0-4e77-b83e-e82dbea51c95"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }

  const gottenVersions: InstalledAddon[] = [];

  for (const addon of addonsKVP) {
    const addonData = await service.checkInstalledVersions(addon.uuid);
    gottenVersions.push(addonData[0]);
  }
  console.log(gottenVersions);

  const routerTester = await service.routerTester(webAPIBaseURL, accessToken);

  describe("AddonAPI and version automation test", async () => {
    for (const addonData of gottenVersions) {
      // need to refactor to regular for
      const addonName = addonData.Addon.Name;
      const installedVersion = addonData.Version;
      const UUID = addonData.UUID;

      it(`${addonName} | Version: ${installedVersion} | UUID: ${UUID} `, async () => {
        expect(
          installedVersion,
          `Failed on current version input being empty or not as expected for ${addonName}`
        )
          .to.be.a("string")
          .that.lengthOf.above(0).is.not.undefined.and.is.not.empty;
        expect(
          gottenVersions.length,
          "failed due to having missing addon versions from API"
        )
          .to.be.a("number")
          .that.is.equal(6);
      });
    }

    it("AddonAPI Parsed test results", async () => {
      expect(
        routerTester,
        "There was an issue with the route test,the response did not include an object as expected"
      ).to.be.an("Object").that.is.not.null.and.is.not.undefined.and.is.not
        .empty;

      expect(routerTester.GET.result, "Failure on GET endpoint")
        .to.be.a("string")
        .that.is.equal("success"),
        expect(routerTester.GET.param, "Failure on GET queryParams")
          .to.be.a("string")
          .that.is.equal("queryParam");

      expect(routerTester.POST.result, "Failure on POST endpoint")
        .to.be.a("string")
        .that.is.equal("success"),
        expect(routerTester.POST.param, "Failure on POST bodyParams")
          .to.be.a("string")
          .that.is.equal("bodyParam");

      expect(routerTester.USE.result, "Failure on USE endpoint")
        .to.be.a("string")
        .that.is.equal("success"),
        expect(routerTester.USE.param, "Failure on USE params")
          .to.be.a("string")
          .that.is.equal("param");
    });
  });

  const testResults = await run();
  return testResults;
}
/** Interceptors test */
export async function InterceptorTester(client: Client, request: Request) {
  const service = new MyService(client);
  const atd = await service.getATD();
  const atdID = atd.ActivityTypeID;
  const { describe, it, expect, run } = Tester();
  const isLocal = false;
  await service.setTestFlag({ InterceptorsTestActive: true });
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  if (isLocal) {
    accessToken = "54a7e16a-bb93-49d0-af7c-d49bd777b92d"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  const pepperiClientAPI = await service.getPepperiClientAPI(
    webAPIBaseURL,
    accessToken
  );
  const transactionUUID = await service.createTransaction(
    webAPIBaseURL,
    accessToken,
    pepperiClientAPI,
    atdID
  );
  const initSync1 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(7500);
  const triggerSet = await service.triggerEvent(
    accessToken,
    transactionUUID,
    webAPIBaseURL,
    "SetFieldValue",
    "TSAInterceptorTrigger",
    "Inserted"
  );
  const triggerIncrement = await service.triggerEvent(
    accessToken,
    transactionUUID,
    webAPIBaseURL,
    "IncrementValue"
  );
  const triggerDeccrement = await service.triggerEvent(
    accessToken,
    transactionUUID,
    webAPIBaseURL,
    "DecrementValue"
  );
  const triggerRecalculate = await service.triggerEvent(
    accessToken,
    transactionUUID,
    webAPIBaseURL,
    "Recalculate"
  );
  await service.setTestFlag({ InterceptorsTestActive: false });
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(10000);
  const udtData = await service.getUDTValues("InterceptorsUDT", 1, "DESC");

  //remove UDT lines after test
  for (const line of udtData) {
    try {
      const res = await service.updateUDTValues(
        line.MapDataExternalID,
        line.MainKey,
        line.SecondaryKey,
        true
      );
      console.log(
        `InterceptorTester::Updated UDTLineID ${line.InternalID},with the following hidden status: ${res.Hidden} `
      );
    } catch (err) {
      console.log(`InterceptorTester:: UDT removal error: ${err}`);
    }
  }
  //MOCHA
  describe("Interceptors automation test", async () => {
    it("Parsed test results", async () => {
      expect(
        udtData,
        "UDT Logging Data returned undefined,please run the test again/check for sync issues"
      )
        .to.be.an("array")
        .that.has.lengthOf(1).and.is.not.null;
      expect(
        udtData[0].Values,
        "The sequence of the interceptors was not correct,please debug it"
      )
        .to.be.an("array")
        .that.is.eql([
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31",
        ]).and.is.not.null;
    });
  });

  const testResults = await run();
  return testResults;
}
/**method to cleanse UDT lines in case one of the test goes wrong */
export async function cleanseUDTLines(client: Client, request: Request) {
  const service = new MyService(client);
  const udtName = request.body.tableName;
  const numOfRecords = request.body.numRecords;
  if (
    udtName === "" ||
    typeof udtName === "undefined" ||
    udtName === null ||
    numOfRecords === null ||
    typeof numOfRecords === "undefined"
  ) {
    const error =
      "Could not find the specified UDT / Sent the wrong records number";
    throw new Error(error);
  }
  const removeLines = await service.getUDTValues(udtName, numOfRecords, "DESC");
  console.log(removeLines);

  removeLines.forEach(async (line) => {
    if (line.InternalID! && typeof line.InternalID === "number") {
      try {
        await service.removeUDTValues(line.InternalID);
      } catch (err) {
        console.log(`There was an error during the UDT lines removal: ${err}`);
      }
    }
  });
}
/**method to run Performence test*/
export async function PerformenceTester(client: Client, request: Request) {
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const cpasAddon = await service.papiClient.addons.installedAddons
    .addonUUID("00000000-0000-0000-0000-0000003eba91")
    .get();
  const cpiNodeAddon = await service.papiClient.addons.installedAddons
    .addonUUID("bb6ee826-1c6b-4a11-9758-40a46acb69c5")
    .get();

  const testData = await service.PerformenceTester(webAPIBaseURL, accessToken); //start CPISide function
  console.log(`PerformenceTester::Test Results: ${testData}`);
  const currentRes: number = parseFloat(testData.currentResults);
  const adalObject = await service.getFromADAL("Load_Test", "testKey3");
  console.log(`PerformenceTester::ADAL Object: ${adalObject}`);
  const bestDuration = parseFloat(adalObject[0].bestRun.Duration);
  const lastRun = parseFloat(adalObject[0].lastRun.Duration);
  const cpiNodeBestVersion: string = adalObject[0].bestRun.nodeVersion;
  const cpasBestVersion: string = adalObject[0].bestRun.cpasVersion;
  const bestRunFlag: boolean = currentRes < bestDuration ? true : false;
  //need to refactor name
  //** Testing data via TS code (to verify which data should go where) */
  const body: AddonData = {
    Key: "testKey3",
    Name: "PerformenceTest",
    Duration: currentRes,
    bestRun: {
      cpasVersion: bestRunFlag ? cpasAddon.Version : cpasBestVersion,
      nodeVersion: bestRunFlag ? cpiNodeAddon.Version : cpiNodeBestVersion,
      Duration: bestRunFlag ? currentRes : bestDuration,
    },
    lastRun: {
      cpasVersion: cpasAddon.Version,
      nodeVersion: cpiNodeAddon.Version,
      Duration: currentRes,
    },
  };
  const gottenAllObjects: boolean =
    typeof testData !== "undefined" &&
      testData &&
      typeof currentRes !== "undefined" &&
      currentRes
      ? true
      : false;

  if (gottenAllObjects) {
    try {
      await service.upsertToADAL("Load_Test", body);
    } catch (err) {
      if (err instanceof Error) {
        console.log(`PerformenceTester:: ${err}`);
      }
    }
  }
  //** Testing data via mocha code (to verify which is correct and parse test results) */
  describe("Performence automation test", async () => {
    it("Parsed test results", async () => {
      expect(
        gottenAllObjects,
        "Failed to bring all test objects from test run/ADAL"
      ).to.be.a("boolean").that.is.true;

      expect(
        currentRes,
        "Test timespan took longer then the best run + average margin and version"
      )
        .to.be.a("number")
        .that.is.below(bestDuration * 1.3);

      expect(
        currentRes,
        "Test timespan took longer then the last run + average margin"
      )
        .to.be.a("number")
        .that.is.below(lastRun * 1.2);
    });
  });

  const testResults = await run();
  return testResults;
}
/**method to run TransactionScope test*/
export async function TransactionScopeTester(client: Client, request: Request) {
  debugger;
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //activate test flag on Load function
  await service.setTestFlag({ TrnScopeTestActive: true });
  //sync again to trigger the test interceptors
  const initSync1 = await service.initSync(accessToken, webAPIBaseURL);
  //wait till sync is over
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "TransactionScope"
  );
  //deactive adal tesk trigger
  await service.setTestFlag({ TrnScopeTestActive: false });
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  //return test results
  return testResults;
}
/**UIObject.Create test*/
export async function UIObjectCreate(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "UIObjectCreate"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}
/**method to run JWTTesterPositive test - positive */
export async function JWTTesterPositive(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  if (isLocal) {
    accessToken = "a8d5082f-daa6-4c54-a91d-77b1b2882f5e"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }

  const JWT = await service.getJWTFromCPISide(webAPIBaseURL, accessToken);
  if (JWT.JWT === "None") {
    console.log(`JWTTester:: There was an error during the test: ${JWT.err}`);
    return `JWTTester::There was an issue with the test,No JWT was returned from CPISide,Error: ${JWT.err}`;
  }

  const validAccountDataForTest = await service.getAccountViaAPI(JWT.JWT);

  const Body: AddonData = {
    Key: "JWTKey1",
    Name: "JWTExpiryTest",
    Token: JWT.JWT,
  };
  await service.upsertToADAL("Load_Test", Body);

  describe("JWT automation test - Positive", async () => {
    it("Parsed test results for a valid Token", async () => {
      expect(validAccountDataForTest[0], "Failed on gotten object from PAPI")
        .to.be.an("object")
        .that.is.not.empty.and.is.not.null.and.is.not.undefined.and.is.not.eql({
          fault: {
            faultstring: "Authorization request denied.",
            detail: {
              errorcode: "Unauthorized",
            },
          },
        });
      expect(
        validAccountDataForTest[0].InternalID,
        "Brought back the wrong object from PAPI"
      ).to.be.a("number").that.is.not.null.and.is.not.undefined,
        expect(
          validAccountDataForTest[0].UUID,
          "Brought back the wrong object from PAPI"
        )
          .to.be.a("string")
          .that.has.lengthOf(36).and.is.not.null.and.is.not.undefined,
        expect(
          validAccountDataForTest[0].Hidden,
          "Brought back the wrong object from PAPI"
        ).to.be.a("boolean").that.is.false.and.that.is.not.null.and.is.not
          .undefined;
    });
  });

  const testResults = await run();
  return testResults;
}
/**method to run JWTTesterNegative test - negative */
export async function JWTTesterNegative(client: Client, request: Request) {
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester();

  const JWTFromAdal = await service.getFromADAL("Load_Test", "JWTKey1");
  const JWT = JWTFromAdal[0].Token;
  const invalidAccountDataForTest = await service.getAccountViaAPI(JWT);
  console.log(invalidAccountDataForTest);
  //test invalid get -> need to finish mocha
  describe("JWT automation test - Negative", async () => {
    it("Parsed test results for an invalid Token", async () => {
      expect(
        invalidAccountDataForTest,
        "The token expiry did not work,GET request from API succeeded,meaning the JWT did not expire"
      )
        .to.be.an("object")
        .that.is.eql({
          fault: {
            faultstring: "Authorization request denied.",
            detail: {
              errorcode: "Unauthorized",
            },
          },
        });
    });
  });

  const testResults = await run();
  return testResults;
}

export async function dataObjectCRUD(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "257ef28b-e2c0-4e77-b83e-e82dbea51c95"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "dataObjectCrud"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function Cpi_Adal(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "257ef28b-e2c0-4e77-b83e-e82dbea51c95"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "Cpi_Adal",
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function pfs_cpi(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "257ef28b-e2c0-4e77-b83e-e82dbea51c95"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "pfs_cpi"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function dataObjectNegativeCRUD(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "dataObjectNegativeCrud"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function clientApiADALTester(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "ClientAPI/ADAL"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function firstUIObjectCRUD(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "firstUIObjectCrud"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function secondUIObjectCRUD(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  console.log(webAPIBaseURL);
  console.log(accessToken);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //run and get mocha tests results from cpiSide
  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    "secondUIObjectCrud"
  );
  //deactive adal tesk trigger
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(2000);
  //return test results
  return testResults;
}

export async function interceptorsTimeoutTester(
  client: Client,
  request: Request
) {
  console.log("InterceptorsTimeoutTestActive::Test started");
  //services setup and perconditions setup
  const service = new MyService(client);
  const clientActionsService = new ClientActionsService(client);
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //activate test flag on Load function
  await service.setTestFlag({ InterceptorsTimeoutTestActive: true });
  //sync again to trigger the test interceptors
  const initSync1 = await service.initSync(accessToken, webAPIBaseURL);
  //wait till sync is over
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  const interceptorsNamesArr = [
    "firstTimeout",
    "secondTimeout",
    "thirdTimeout",
    "fourthTimeout",
    "fifthTimeout",
  ];
  //setting up global map for client actions test data
  global["map"] = new Map<string, any>();
  console.log(
    "InterceptorsTimeoutTestActive::Triggering buttonPressed event to get client actions"
  );
  //looping on each field to trigger cpi-side related events -> these will trigger the corresponding client actions
  for (const button of interceptorsNamesArr) {
    console.log(`InterceptorsTimeoutTestActive::Started triggering ${button}`);
    const options = {
      EventKey: "TSAButtonPressed",
      EventData: JSON.stringify({
        FieldID: button,
      }),
    };
    //calling recursive function - event loop to run all client actions in existant for the current interceptor
    const clientAction = await clientActionsService.EmitClientEventWithTimeout(
      webAPIBaseURL,
      accessToken,
      options
    );
    console.log(`InterceptorsTimeoutTestActive::Finished triggering ${button}`);
    await service.sleep(2000);
  }
  await service.setTestFlag({ InterceptorsTimeoutTestActive: false });
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.sleep(2000);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(10000);
  const udtData = await service.getUDTValues("interceptorsTimeout", 1, "DESC");
  console.log(udtData);
  const udtDataTimingData = await service.getUDTValues(
    "interceptorsTiming",
    1,
    "DESC"
  );
  console.log(udtDataTimingData);
  //getting actions back from global map after client actions responses (event loop finished)
  const actions = global["map"] as Map<string, any>;

  try {
    const res = await service.updateUDTValues(
      udtData[0].MapDataExternalID,
      udtData[0].MainKey,
      udtData[0].SecondaryKey,
      true
    );
    console.log(
      `InterceptorsTimeoutTestActive::Updated UDTLineID ${udtData[0].InternalID},with the following hidden status: ${res.Hidden} `
    );
  } catch (err) {
    console.log(`InterceptorsTimeoutTestActive:: UDT removal error: ${err}`);
  }

  try {
    const res = await service.updateUDTValues(
      udtDataTimingData[0].MapDataExternalID,
      udtDataTimingData[0].MainKey,
      udtDataTimingData[0].SecondaryKey,
      true
    );
    console.log(
      `InterceptorsTimeoutTestActive::Updated UDTLineID ${udtDataTimingData[0].InternalID},with the following hidden status: ${res.Hidden} `
    );
  } catch (err) {
    console.log(`InterceptorsTimeoutTestActive:: UDT removal error: ${err}`);
  }

  const timingData = JSON.parse(udtDataTimingData[0].Values[0]);

  describe("Interceptors timeouts automation test", async () => {
    console.log("InterceptorsTimeoutTestActive:: Started mocha section");

    it("Testing sequence", async () => {
      expect(
        udtData[0].Values,
        "Failed on wrong sequence returning from test"
      ).to.deep.equal([
        "1,5,8,9,10,7,11,13,16,17,18,15,19,22,25,26,27,24,21,28,32,35,36,37,38,39,42,43,46,47,48",
      ]);
    });

    for (const [key, value] of Object.entries(timingData)) {
      it(`Testing timing for ${key} inteceptor`, async () => {
        const executionTime = value as number;
        expect(executionTime / 1000)
          .to.be.a("number")
          .that.is.below(11);
      });
    }
  });
  console.log("InterceptorsTimeoutTestActive:: Test finished");
  const testResults = await run();
  return testResults;
}

export async function SyncInterceptorsTest(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const { describe, it, expect, run } = Tester();

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 20);
  //set test flag to On
  const flagOn = await service.setTestFlag({
    SyncInteceptorsActive: true
  });
  await service.sleep(5000);
  const firstSync = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 20);
  await service.sleep(10000);
  const secondSync = await service.initSync(accessToken, webAPIBaseURL); // this triggers the sync interceptors
  await service.getSyncStatus(accessToken, webAPIBaseURL, 20);
  //set test flag to Off
  const flagOff = await service.setTestFlag({
    SyncInteceptorsActive: false
  }); // deactivates test
  const thirdSync = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(15000);
  //need to add mocha and UDT get
  const udtData = await service.getUDTValues("SyncInterceptors", 2, "DESC");
  console.log(udtData);
  const data = await service.parseJSONObject(udtData[1].Values);

  // remove UDT lines after test
  const ModificationDate = (new Date().toISOString()).split("T")[0];
  for (const line of udtData) {
    try {
      const res = await service.updateUDTValues(
        line.MapDataExternalID,
        line.MainKey,
        line.SecondaryKey,
        true
      );
      console.log(
        `SyncInterceptorsTest::Updated UDTLineID ${line.InternalID},with the following hidden status: ${res.Hidden} `
      );
    } catch (err) {
      console.log(`SyncInterceptorsTest::UDT Removal error: ${err}`);
    }
  }

  //mocha test
  describe("Sync interceptors events automation test", async () => {
    it("Sync started and stooped events test cases", async () => {
      expect(udtData, "Failed on udt returning wrong number of objects").to.be.an("array").that.has.lengthOf(2);
      expect(udtData[0].SecondaryKey, "Failed on wrong interceptor firing").to.be.a("string").that.is.equal("SyncStarted");
      expect(udtData[0].MainKey.split("T")[0], "Failed on wrong date returning").to.be.a("string").that.is.equal(`SyncStarted${ModificationDate}`);
      expect(udtData[1].SecondaryKey, "Failed on wrong interceptor firing").to.be.a("string").that.is.equal("SyncStopped");
      expect(udtData[1].MainKey.split("T")[0], "Failed on wrong date returning").to.be.a("string").that.is.equal(`SyncStopped${ModificationDate}`);

    });
    it("Sync stopped event data test cases", async () => {


      for (const value of udtData[1].Values) {
        if (value.includes("LastSyncDateTime")) {
          expect(value, "failed on client info returning wrong output").that.include("LastSyncDateTime");
        }
      }
    });
  });
  const testResults = await run();
  return testResults;
}
//========================Scripts============================================
export async function scriptClientAPITester(client: Client, request: Request) {
  console.log("scriptClientAPITester::Test started");
  const scriptsService = new ScriptService(client);
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester();
  console.log("scriptClientAPITester::before getting scripts list");
  const clientAPIScriptList: Script[] = await scriptsService.getAllScripts();
  console.log("scriptClientAPITester::after getting scripts list");
  const map = new Map<string, [string, string]>();
  const scriptObjectsUUID = await scriptsService.getTestDataObject();
  //when this endpoint will allow filtering by name -> will be refactored
  //when scripts use data instead of cpi-meta-data this will need to be refactored, the GET endpoint will be able to filter by name,now it can't and this is the workaround
  for (const script of clientAPIScriptList) {
    if (script.Name.includes("ClientAPI")) {
      const Description = script.Description;
      switch (Description) {
        case "item get":
          map.set(script.Key, [scriptObjectsUUID.itemUUID, script.Name]);
          break;
        case "activity get":
          map.set(script.Key, [scriptObjectsUUID.activityUUID, script.Name]);
          break;
        case "line add":
          map.set(script.Key, [scriptObjectsUUID.transactionUUID, script.Name]);
          break;
        case "transaction get":
          map.set(script.Key, [scriptObjectsUUID.transactionUUID, script.Name]);
          break;
        case "account get":
          map.set(script.Key, [scriptObjectsUUID.accountUUID, script.Name]);
          break;
        case "account add":
          map.set(script.Key, [scriptObjectsUUID.accountExID, script.Name]);
          break;
        case "transaction add":
          map.set(script.Key, [scriptObjectsUUID.accountUUID, script.Name]);
          break;
        case "activity add":
          map.set(script.Key, [scriptObjectsUUID.accountUUID, script.Name]);
          break;
      }
    }
  }
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  await service.sleep(5000);
  const connectAccount = await scriptsService.connectAccount(
    webAPIBaseURL,
    accessToken,
    scriptObjectsUUID.accountUUID
  );

  describe("Scripts clientAPI automation test", async () => {
    for (const [key, value] of map) {
      let response;
      it(`Initializing ${value[1]} script data `, async () => {
        const Data = {
          Data: { UUID: value[0] },
        };
        console.log(
          `scriptClientAPITester::currently running ${value[1]} script`
        );
        response = await scriptsService.runScript(
          webAPIBaseURL,
          accessToken,
          key,
          Data
        );
      });
      it(`Parsed test results for ${value[1]} script `, async () => {
        expect(
          response.Result,
          "Failed on ClientAPI returning empty object"
        ).to.be.an("object").that.is.not.null.and.undefined;
        expect(
          response.Result.success,
          "Failed on ClientAPI returning"
        ).to.be.a("boolean").that.is.true;
        if (
          typeof response.Result.result === "object" &&
          response.Result.result.length === undefined
        ) {
          expect(
            response.Result.result,
            "Failed on result returning with the wrong type"
          ).to.be.an("object").that.is.not.null.and.undefined;
          if (response.Result.result.UUID) {
            expect(
              response.Result.result.UUID,
              "Failed on result returning without UUID"
            ).to.be.a("string").that.is.not.null.and.undefined;
          }
        } else if (typeof response.Result.object === "object") {
          expect(
            response.Result.object,
            "Failed on result returning with the wrong type"
          ).to.be.an("object").that.is.not.null.and.undefined;
          if (response.Result.object.UUID) {
            expect(
              response.Result.object.UUID,
              "Failed on result returning without UUID"
            ).to.be.a("string").that.is.not.null.and.undefined;
          }
        } else if (
          response.Result.result !== undefined &&
          response.Result.result.length === 1
        ) {
          expect(
            response.Result.result[0],
            "Failed on result returning with the wrong type"
          ).to.be.an("object").that.is.not.null.and.undefined;
          if (response.Result.result[0].UUID) {
            expect(
              response.Result.result[0].UUID,
              "Failed on result returning without UUID"
            ).to.be.a("string").that.is.not.null.and.undefined;
          }
        }
      });
    }
  });

  const testResults = await run();
  return testResults;
}

export async function scriptsNegativeTester(client: Client, request: Request) {
  console.log("scriptsNegativeTester::Test started");
  const scriptsService = new ScriptService(client);
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester();
  console.log("scriptsNegativeTester::before getting scripts list");
  const scripstList: Script[] = await scriptsService.getAllScripts();
  console.log("scriptsNegativeTester::after getting scripts list");
  const map = new Map<string, string>();
  //when this endpoint will allow filtering by name -> will be refactored
  //when scripts use data instead of cpi-meta-data this will need to be refactored, the GET endpoint will be able to filter by name,now it can't and this is the workaround
  for (const script of scripstList) {
    if (
      script.Description.includes("Security") ||
      script.Description.includes("Negative")
    ) {
      const Description = script.Description;
      //need to change according to negative logic and requests
      switch (Description) {
        case "Security":
          map.set(script.Key, script.Name);
          break;
        case "Negative":
          map.set(script.Key, script.Name);
          break;
        default:
          break;
      }
    }
  }

  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  await service.sleep(2000);

  const randNumber = Math.floor((Math.random() + 1) * 1000);

  describe("Scripts Negative automation test", async () => {
    for (const [key, value] of map) {
      let response;
      let Data;
      //currently dialog does not return ac exception
      it(`Initializing ${value} script data `, async () => {
        console.log(key);
        console.log(value);
        if (value.includes("Sleep") || value.includes("process.exit(1)")) {
          Data = {
            Data: { ms: randNumber },
          };
        } else if (value.includes("missingParameters")) {
          Data = {
            Data: { var1: Math.random() },
          };
        } else if (value.includes("NegativeWithParameters")) {
          Data = {
            Data: { number: "string", string: 9, boolean: 3, object: "{}" },
          };
        } else {
          Data = {
            Data: {
              xxxx: randNumber,
              y: randNumber * 2,
              myText: "start",
              myText2: "end",
            },
          };
        }
        console.log(`scriptsNegativeTester::currently running ${value} script`);
        response = await scriptsService.runScript(
          webAPIBaseURL,
          accessToken,
          key,
          Data
        );
        console.log(response);
        console.log(`scriptsNegativeTester::finished running ${value} script`);
      });
      it(`Parsed test results for ${value} script `, async () => {
        switch (value) {
          case "Sleep":
            expect(
              response,
              "failed on sleep script returning the wrong response"
            ).to.be.an("object").that.is.not.null.and.undefined;
            expect(
              response.Result,
              "Failed on sleep script returning wrong response value"
            )
              .to.be.a("string")
              .that.is.equal(`waited ${randNumber / 1000} secs`);
            break;

          case "process.exit(1)":
            expect(
              response,
              "Failed on process.exit(1) script returning the wrong output"
            ).to.be.an("object").that.is.not.null.and.undefined;
            expect(
              response.Error,
              "script returning wrong error for process.exit(1)"
            )
              .to.be.a("string")
              .that.is.equal("process.exit is not a function");
            break;

          case "Dialog":
            expect(
              response,
              "Failed on Dialog script returning the wrong output"
            ).to.be.an("object").that.is.not.null.and.undefined;
            expect(response.Error, "script returning wrong error for Dialog")
              .to.be.an("string")
              .that.is.equal("client is not defined").and.is.not.null.and
              .undefined;

            break;

          case "missingParameters":
            expect(
              response,
              "failed on missingParameters script returning the wrong response"
            ).to.be.an("object").that.is.not.null.and.undefined;
            expect(
              response.Result,
              "Failed on missingParameters script returning wrong response value"
            )
              .to.be.a("number")
              .that.is.above(0)
              .and.below(1);
            break;

          case "NegativeWithParameters":
            expect(
              response,
              "Failed on NegativeWithParameters script returning the wrong output"
            ).to.be.an("object").that.is.not.null.and.undefined;
            expect(
              response.Error,
              "Failed on NegativeWithParameters script returning the wrong output"
            )
              .to.be.a("string")
              .that.is.equal("invalid parameter value");
            break;

          default:
            break;
        }
      });
    }
  });

  const testResults = await run();
  return testResults;
}

export async function scriptsPositiveTester(client: Client, request: Request) {
  console.log("scriptsPositiveTester::Test started");
  const scriptsService = new ScriptService(client);
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester();
  console.log("scriptsPositiveTester::before getting scripts list");
  const scripstList: Script[] = await scriptsService.getAllScripts();
  console.log("scriptsPositiveTester::after getting scripts list");
  const map = new Map<string, string>();
  //when this endpoint will allow filtering by name -> will be refactored
  //when scripts use data instead of cpi-meta-data this will need to be refactored, the GET endpoint will be able to filter by name,now it can't and this is the workaround
  for (const script of scripstList) {
    if (script.Description.includes("Positive")) {
      const Description = script.Description;
      switch (Description) {
        case "Positive":
          map.set(script.Key, script.Name);
          break;

        default:
          break;
      }
    }
  }

  const testValuesObject = {
    number: { number: 10, string: "strung", boolean: false, object: undefined },
    string: { number: 9, string: "string", boolean: false, object: undefined },
    boolean: { number: 9, string: "strung", boolean: true, object: undefined },
    object: { number: 9, string: "strung", boolean: false, object: undefined },
    undefined: { number: 9, string: "strung", boolean: false, object: {} },
    negative: {},
  };
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  await service.sleep(2000);
  describe("Scripts Positive automation test", async () => {
    for (const [key, value] of map) {
      switch (value) {
        case "WithParameters":
          for (const [testKey, testValue] of Object.entries(testValuesObject)) {
            let Data;
            let response;

            Data = {
              Data: testValue,
            };

            it(`Initializing ${value} - ${testKey} script data `, async () => {
              console.log(
                `scriptsNegativeTester::currently running ${value} - ${testKey} script`
              );
              response = await scriptsService.runScript(
                webAPIBaseURL,
                accessToken,
                key,
                Data
              );
            });
            it(`Parsed test results for ${value} - ${testKey} script data `, async () => {
              const responseType = typeof response.Result;
              if (response.Error) {
                expect(
                  response,
                  "Response error object returned with wrong type"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  response.Error,
                  "Failed on WithParameters script returning value although not parameters were sent"
                )
                  .to.be.a("string")
                  .that.is.equal("invalid parameter value");
              }
              switch (responseType) {
                case "string":
                  expect(
                    response.Result,
                    "Failed on string type not returning the correct type"
                  )
                    .to.be.a("string")
                    .that.is.equal("string");
                  break;
                case "boolean":
                  expect(
                    response.Result,
                    "Failed on boolean type not returning the correct type"
                  )
                    .to.be.a("boolean")
                    .that.is.equal(true);
                  break;
                case "number":
                  expect(
                    response.Result,
                    "Failed on number type not returning the correct type"
                  )
                    .to.be.a("number")
                    .that.is.equal(10);
                  break;
                case "object":
                  expect(
                    response.Result,
                    "Failed on object type not returning the correct type"
                  )
                    .to.be.a("object")
                    .that.is.deep.equal({
                      string: "strung",
                      number: 9,
                      boolean: false,
                    });
                  break;
                case "undefined":
                  expect(
                    response.Result,
                    "Failed on undefined type not returning the correct type"
                  )
                    .to.be.a("undefined")
                    .that.is.equal(undefined);
                  break;
                default:
                  break;
              }
            });
          }
          break;
        default:
          break;
      }
    }
  });
  const testResults = await run();
  return testResults;
}

export async function runCPISideScriptTester(client: Client, request: Request) {
  console.log("runCPISideScriptTester::Test started");
  const scriptsService = new ScriptService(client);
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester();
  console.log("runCPISideScriptTester::before getting scripts list");
  const scripstList: Script[] = await scriptsService.getAllScripts();
  console.log("runCPISideScriptTester::after getting scripts list");
  const map = new Map<string, string>();
  //when this endpoint will allow filtering by name -> will be refactored
  //when scripts use data instead of cpi-meta-data this will need to be refactored, the GET endpoint will be able to filter by name,now it can't and this is the workaround
  for (const script of scripstList) {
    if (script.Description.includes("Positive")) {
      const Description = script.Description;
      //need to change according to negative logic and requests
      switch (Description) {
        case "Positive":
          map.set(script.Key, script.Name);
          break;

        default:
          break;
      }
    }
  }

  const testValuesObject = {
    number: { number: 10, string: "strung", boolean: false, object: undefined },
    string: { number: 9, string: "string", boolean: false, object: undefined },
    boolean: { number: 9, string: "strung", boolean: true, object: undefined },
    object: { number: 9, string: "strung", boolean: false, object: undefined },
    undefined: { number: 9, string: "strung", boolean: false, object: {} },
    negative: {},
  };
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.sleep(2000);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(10000);

  describe("Scripts runCPISideScriptTester Positive automation test", async () => {
    for (const [key, value] of map) {
      switch (value) {
        case "WithParameters":
          for (const [testKey, testValue] of Object.entries(testValuesObject)) {
            let Data;
            let response;

            Data = {
              Data: testValue,
            };

            it(`Initializing ${value} - ${testKey} script data `, async () => {
              console.log(
                `runCPISideScriptTester::currently running ${value} - ${testKey} script`
              );
              response = await scriptsService.runCPISideScript(
                webAPIBaseURL,
                accessToken,
                key,
                Data
              );
            });
            it(`Parsed test results for ${value} - ${testKey} script data `, async () => {
              const responseType = typeof response.Result;
              if (response.Error) {
                expect(
                  response,
                  "Response error object returned with wrong type"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  response.Error,
                  "Failed on WithParameters script returning value although not parameters were sent"
                )
                  .to.be.a("string")
                  .that.is.equal("invalid parameter value");
              }
              switch (responseType) {
                case "string":
                  expect(
                    response.Result,
                    "Failed on string type not returning the correct type"
                  )
                    .to.be.a("string")
                    .that.is.equal("string");
                  break;
                case "boolean":
                  expect(
                    response.Result,
                    "Failed on boolean type not returning the correct type"
                  )
                    .to.be.a("boolean")
                    .that.is.equal(true);
                  break;
                case "number":
                  expect(
                    response.Result,
                    "Failed on number type not returning the correct type"
                  )
                    .to.be.a("number")
                    .that.is.equal(10);
                  break;
                case "object":
                  expect(
                    response.Result,
                    "Failed on object type not returning the correct type"
                  )
                    .to.be.a("object")
                    .that.is.deep.equal({
                      string: "strung",
                      number: 9,
                      boolean: false,
                    });
                  break;
                case "undefined":
                  expect(
                    response.Result,
                    "Failed on undefined type not returning the correct type"
                  )
                    .to.be.a("undefined")
                    .that.is.equal(undefined);
                  break;
                default:
                  break;
              }
            });
          }
          break;
        default:
          break;
      }
    }
  });
  const testResults = await run();
  return testResults;
}
//=======================client actions=======================================
//https://pepperi-addons.github.io/client-actions-docs/
export async function clientActionsTester(client: Client, request: Request) {
  console.log("clientActionsTester::Test started");
  //services setup and perconditions setup
  const service = new MyService(client);
  const clientActionsService = new ClientActionsService(client);
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //activate test flag on Load function
  await service.setTestFlag({ clientActionsTestActive: true });
  //sync again to trigger the test interceptors
  const initSync1 = await service.initSync(accessToken, webAPIBaseURL);
  //wait till sync is over
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  const interceptorsNamesArr = [
    "TSAAlert",
    "TSACaptureGeo",
    "TSAScanBarcode",
    "TSAHUD",
    "TSANavigateToCustomPage",
    "TSANavigateToHome",
    "TSANavigateToCustomModal",
    "TSANavigateBack",
  ];
  //setting up global map for client actions test data
  global["map"] = new Map<string, any>();
  console.log(
    "clientActionsTester::Triggering buttonPressed event to get client actions"
  );
  //looping on each field to trigger cpi-side related events -> these will trigger the corresponding client actions
  for (const button of interceptorsNamesArr) {
    console.log(`clientActionsTester::Started triggering ${button}`);
    const options = {
      EventKey: "TSAButtonPressed",
      EventData: JSON.stringify({
        FieldID: button,
      }),
    };
    //calling recursive function - event loop to run all client actions in existant for the current interceptor
    const clientAction = await clientActionsService.EmitClientEvent(
      webAPIBaseURL,
      accessToken,
      options
    );
    console.log(`clientActionsTester::Finished triggering ${button}`);
  }
  await service.setTestFlag({ clientActionsTestActive: false });
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.sleep(2000);
  //await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(1000);
  //getting actions back from global map after client actions responses (event loop finished)
  const actions = global["map"] as Map<string, any>; //key - client action UUID,value - data
  const arrActions: any[] = [];
  for (const action of actions) {
    arrActions.push(action);
  }
  console.log(actions);
  describe("Client Actions Automation positive test", async () => {
    for (const [key, value] of actions) {
      const Object = JSON.parse(value);
      const parsedActionData: ClientAction = JSON.parse(Object.Value);
      const Type = parsedActionData.Type;
      let Title = ""; //used to enter the accuracy/title into the test title - ok if not populated,some actions do not have Titles
      //arrActions.push(parsedActionData);
      //filter test action according to type
      switch (Type) {
        //dialog client actions functions test
        case "Dialog":
          Title = parsedActionData.Data.Title; //getting filter to test according to Title
          it(`Client Actions Automation - ${Type} - ${Title}`, async () => {
            //general tests for all action types
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on Dialog client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("Dialog");
            expect(
              parsedActionData.Data.IsHtml,
              "Failed on isHtml returning wrong value/type"
            ).to.be.a("boolean").that.is.false;
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            //filter actions tests accodring to subtype as listed below
            switch (Title) {
              //alert test
              case "alert":
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("alert");
                expect(
                  parsedActionData.Data.Content,
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("putin is douchebag");
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(1);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Ok");
                break;
              //confirm test
              case "confirm":
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("confirm");
                expect(
                  parsedActionData.Data.Content,
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("putin is a huylo");
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(2);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Ok");
                expect(
                  parsedActionData.Data.Actions[1],
                  "Failed on Actions[1] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[1].Key,
                  "Failed on Actions[1].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[1].Title,
                  "Failed on Actions[1].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Cancel");
                break;
              //showDialog test
              case "showDialog":
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("showDialog");
                expect(
                  parsedActionData.Data.Content,
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("putin pashul nahuy dibilnaya tvar");
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(3);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("not cool putin");
                expect(
                  parsedActionData.Data.Actions[1],
                  "Failed on Actions[1] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[1].Key,
                  "Failed on Actions[1].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[1].Title,
                  "Failed on Actions[1].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("really not cool putin");
                expect(
                  parsedActionData.Data.Actions[2],
                  "Failed on Actions[2] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[2].Key,
                  "Failed on Actions[2].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[2].Title,
                  "Failed on Actions[2].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("putin is a boomer");
                break;
              default:
                break;
            }
          });
          break;
        case "HUD":
          Title = parsedActionData.Data.State; //getting filter to test according to state
          const HUDKey = global["HUDKey"].toUpperCase() as string;
          it(`Client Actions Automation - ${Type} - ${Title}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on HUD client action type returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("HUD");
            expect(
              parsedActionData.Callback,
              "Failed on HUD client action callback returning the wrong type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            switch (Title) {
              case "Show":
                expect(
                  parsedActionData.Data.State,
                  "Failed on returning the wrong state on HUD Show"
                )
                  .to.be.a("string")
                  .that.is.equal("Show");
                expect(
                  parsedActionData.Data.Message,
                  "Failed on returning the wrong message on HUD Show"
                )
                  .to.be.a("string")
                  .that.is.equal("Waiting....");
                expect(
                  parsedActionData.Data.CloseMessage,
                  "Failed on returning the wrong CloseMessage on HUD Show"
                )
                  .to.be.a("string")
                  .that.is.equal("Press to close");
                expect(
                  parsedActionData.Data.CancelEventKey,
                  "Failed on cancel event key returning wrong value"
                )
                  .to.be.a("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Interval,
                  "Failed on wrong interval returning"
                )
                  .to.be.a("number")
                  .that.is.equal(0.5);
                break;
              case "Poll":
                expect(
                  parsedActionData.Data.State,
                  "Failed on returning the wrong state on HUD Poll"
                )
                  .to.be.a("string")
                  .that.is.equal("Poll");
                expect(
                  parsedActionData.Data.Interval,
                  "Failed on wrong interval returning"
                )
                  .to.be.a("number")
                  .that.is.equal(0.5);
                expect(
                  parsedActionData.Data.HUDKey,
                  "Failed on hud returning wrong HUDKey"
                )
                  .to.be.a("string")
                  .that.is.equal(HUDKey);
                expect(
                  parsedActionData.Data.Message,
                  "Failed on poll returning wrong message"
                )
                  .to.be.a("string")
                  .that.is.equal("Waiting....");
                break;
              case "Hide":
                expect(
                  parsedActionData.Data.State,
                  "Failed on returning the wrong state on HUD hide"
                )
                  .to.be.a("string")
                  .that.is.equal("Hide");
                expect(
                  parsedActionData.Data.HUDKey,
                  "Failed on hud returning wrong HUDKey"
                )
                  .to.be.a("string")
                  .that.is.equal(HUDKey);
                break;
              default:
                break;
            }
          });
          break;
        case "Barcode":
          it(`Client Actions Automation - ${Type}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on Barcode client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("Barcode");
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
          });
          break;
        case "GeoLocation":
          Title = parsedActionData.Data.Accuracy; //getting filter to test according to Accuracy
          it(`Client Actions Automation - ${Type} - ${Title}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on CaptureGeo client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("GeoLocation");
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            switch (Title) {
              case "Low":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("Low");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(400);
                break;
              case "Medium":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("Medium");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(200);
                break;
              case "High":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("High");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(300);
                break;
            }
          });
          break;
        case "Navigation":
          const history = parsedActionData.Data.History;
          const url = parsedActionData.Data.URL;
          it(`Client Actions Automation - ${Type} - ${url} `, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on Navigate client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("Navigation");
            switch (url) {
              case "/customblankpage":
                history === "ClearTo"
                  ? expect(history, "Failed on history returning wrong value")
                    .to.be.a("string")
                    .that.is.equal("ClearTo")
                  : expect(history, "Failed on history returning wrong value")
                    .to.be.a("string")
                    .that.is.equal("None");
                break;
              case "/homepage":
                expect(history, "Failed on history returning wrong value")
                  .to.be.a("string")
                  .that.is.equal("None");
                break;
              case "back":
                expect(history, "Failed on history returning wrong value")
                  .to.be.a("string")
                  .that.is.equal("None");
                break;
            }
          });
          break;

        default:
          break;
      }
    }
    it(`Client Actions Automation - Testing No actions were made after Navigate`, async () => {
      const action = JSON.parse(arrActions[arrActions.length - 1][1]);
      const parsedAction = JSON.parse(action.Value);
      console.log(parsedAction);
      expect(
        parsedAction,
        "failed on last action data returning wrong type"
      ).to.be.an("object").that.is.not.undefined.and.empty;
      expect(
        parsedAction.Type,
        "Failed on wrong type returning for last action"
      )
        .to.be.a("string")
        .that.is.equal("Navigation");
      expect(
        parsedAction.Data.History,
        "Failed on history returning wrong value on last action"
      )
        .to.be.a("string")
        .that.is.equal("None");
      expect(
        parsedAction.Data.URL,
        "Failed on URL returning wrong value on last action"
      )
        .to.be.a("string")
        .that.is.equal("back");
    });
  });
  console.log("clientActionsTester::Test Finished");
  const testResults = await run();
  return testResults;
  // return {
  //   actions: arrActions,
  // };
}

export async function withinHudClientActionsTester(
  client: Client,
  request: Request
) {
  console.log("withinHudClientActionsTester::Test started");
  //services setup and perconditions setup
  const service = new MyService(client);
  const clientActionsService = new ClientActionsService(client);
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //activate test flag on Load function
  await service.setTestFlag({ clientActionsWithinHudTestActive: true });
  //sync again to trigger the test interceptors
  const initSync1 = await service.initSync(accessToken, webAPIBaseURL);
  //wait till sync is over
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  const interceptorsNamesArr = [
    "TSAGeoLocationWithinHud",
    "TSABarcodeWithinHud",
    "TSAAlertWithinHud",
    "TSAWithinMixedHudFirst",
    "TSAWithinMixedHudSecond",
  ];
  //setting up global map for client actions test data
  global["map"] = new Map<string, any>();
  console.log(
    "withinHudClientActionsTester::Triggering buttonPressed event to get client actions"
  );
  //looping on each field to trigger cpi-side related events -> these will trigger the corresponding client actions
  for (const button of interceptorsNamesArr) {
    console.log(`withinHudClientActionsTester::Started triggering ${button}`);
    const options = {
      EventKey: "TSAButtonPressed",
      EventData: JSON.stringify({
        FieldID: button,
      }),
    };
    //calling recursive function - event loop to run all client actions in existant for the current interceptor
    const clientAction = await clientActionsService.EmitClientEvent(
      webAPIBaseURL,
      accessToken,
      options
    );
    console.log(`withinHudClientActionsTester::Finished triggering ${button}`);
  }
  await service.setTestFlag({ clientActionsWithinHudTestActive: false });
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.sleep(2000);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  //getting actions back from global map after client actions responses (event loop finished)
  const actions = global["map"] as Map<string, any>; //key - client action UUID,value - data
  //const arrActions: any[] = [];

  describe("Client Actions Automation withinHudClientActionsTester test", async () => {
    for (const [key, value] of actions) {
      const Object = JSON.parse(value);
      const parsedActionData: ClientAction = JSON.parse(Object.Value);
      const Type = parsedActionData.Type;
      let Title = ""; //used to enter the accuracy/title into the test title - ok if not populated,some actions do not have Titles
      //arrActions.push(parsedActionData);
      //filter test action according to type
      switch (Type) {
        //dialog client actions functions test
        case "Dialog":
          Title = parsedActionData.Data.Title; //getting filter to test according to Title
          it(`withinHudClientActionsTester - ${Type} - ${Title}`, async () => {
            //general tests for all action types
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on Dialog client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("Dialog");
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            //filter actions tests accodring to subtype as listed below
            switch (Title) {
              //alert test
              case "alertWithinHud":
                expect(
                  parsedActionData.Data.IsHtml,
                  "Failed on isHtml returning wrong value/type"
                ).to.be.a("boolean").that.is.true;
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("alertWithinHud");
                expect(
                  parsedActionData.Data.Content,
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("<p>Slava Ukraine<p>");
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(1);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Ok");
                break;
              //confirm test
              case "confirmWithinHud":
                expect(
                  parsedActionData.Data.IsHtml,
                  "Failed on isHtml returning wrong value/type"
                ).to.be.a("boolean").that.is.false;
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("confirmWithinHud");
                expect(
                  parsedActionData.Data.Content,
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("putin is a huylo yayaya");
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(2);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Ok");
                expect(
                  parsedActionData.Data.Actions[1],
                  "Failed on Actions[1] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[1].Key,
                  "Failed on Actions[1].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[1].Title,
                  "Failed on Actions[1].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Cancel");
                break;
              //showDialog test
              case "showDialogWithinHud":
                expect(
                  parsedActionData.Data.IsHtml,
                  "Failed on isHtml returning wrong value/type"
                ).to.be.a("boolean").that.is.false;
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("showDialogWithinHud");
                expect(
                  parsedActionData.Data.Content,
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("putin pashul nahuy dibilnaya tvar yaya");
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(3);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("not cool putin yaya");
                expect(
                  parsedActionData.Data.Actions[1],
                  "Failed on Actions[1] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[1].Key,
                  "Failed on Actions[1].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[1].Title,
                  "Failed on Actions[1].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("really not cool putin yaya");
                expect(
                  parsedActionData.Data.Actions[2],
                  "Failed on Actions[2] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[2].Key,
                  "Failed on Actions[2].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[2].Title,
                  "Failed on Actions[2].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("putin is a boomeryaya");
                break;

              default:
                break;
            }
          });
          break;
        //hud client actions functions test
        case "HUD":
          Title = parsedActionData.Data.State; //getting filter to test according to state
          const HUDKey = global["HUDKey"].toUpperCase() as string;
          it(`withinHudClientActionsTester - ${Type} - ${Title}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on HUD client action type returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("HUD");
            expect(
              parsedActionData.Callback,
              "Failed on HUD client action callback returning the wrong type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            switch (Title) {
              case "Show":
                expect(
                  parsedActionData.Data.State,
                  "Failed on returning the wrong state on HUD Show"
                )
                  .to.be.a("string")
                  .that.is.equal("Show");
                expect(
                  parsedActionData.Data.Message,
                  "Failed on returning the wrong message on HUD Show"
                )
                  .to.be.a("string")
                  .that.is.equal("withinHudTest");
                expect(
                  parsedActionData.Data.CloseMessage,
                  "Failed on returning the wrong CloseMessage on HUD Show"
                )
                  .to.be.a("string")
                  .that.is.equal("HUD!!!");
                expect(
                  parsedActionData.Data.CancelEventKey,
                  "Failed on cancel event key returning wrong value"
                )
                  .to.be.a("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Interval,
                  "Failed on wrong interval returning"
                )
                  .to.be.a("number")
                  .that.is.above(0);
                break;
              case "Poll":
                expect(
                  parsedActionData.Data.State,
                  "Failed on returning the wrong state on HUD Poll"
                )
                  .to.be.a("string")
                  .that.is.equal("Poll");
                expect(
                  parsedActionData.Data.Interval,
                  "Failed on wrong interval returning"
                )
                  .to.be.a("number")
                  .that.is.above(0);
                expect(
                  parsedActionData.Data.HUDKey,
                  "Failed on hud returning wrong HUDKey"
                )
                  .to.be.a("string")
                  .that.is.equal(HUDKey);
                expect(
                  parsedActionData.Data.Message,
                  "Failed on poll returning wrong message"
                )
                  .to.be.a("string")
                  .that.is.equal("withinHudTest");
                break;
              case "Hide":
                console.log(`withinHudTe$ter:: object for test:`);
                console.log(parsedActionData);
                expect(
                  parsedActionData.Data.State,
                  "Failed on returning the wrong state on HUD hide"
                )
                  .to.be.a("string")
                  .that.is.equal("Hide");
                expect(
                  parsedActionData.Data.HUDKey,
                  "Failed on hud returning wrong HUDKey"
                )
                  .to.be.a("string")
                  .that.is.equal(HUDKey);
                break;
              default:
                break;
            }
          });
          break;
        //barcode client actions functions test
        case "Barcode":
          it(`withinHudClientActionsTester - ${Type}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on Barcode client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("Barcode");
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
          });
          break;
        //hud client actions functions test
        case "GeoLocation":
          Title = parsedActionData.Data.Accuracy; //getting filter to test according to Accuracy
          it(`Client Actions Automation - ${Type} - ${Title}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on CaptureGeo client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("GeoLocation");
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            switch (Title) {
              case "Low":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("Low");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(1500);
                break;
              case "Medium":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("Medium");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(2000);
                break;
              case "High":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("High");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(3000);
                break;
            }
          });
          break;
        default:
          break;
      }
    }
  });

  console.log("withinHudClientActionsTester::Test Finished");
  const testResults = await run();
  return testResults;
  // return {
  //   actions: arrActions,
  // };
}

export async function clientActionsInterceptorsTester(
  client: Client,
  request: Request
) {
  console.log("clientActionsInterceptorsTester::Test started");
  //services setup and perconditions setup
  const service = new MyService(client);
  const clientActionsService = new ClientActionsService(client);
  const { describe, it, expect, run } = Tester();
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //activate test flag on Load function
  await service.setTestFlag({ InterceptorActionsTest: true });
  //sync again to trigger the test interceptors
  const initSync1 = await service.initSync(accessToken, webAPIBaseURL);
  //wait till sync is over
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  const interceptorsNamesArr = [
    "firstTrigger",
    "secondTrigger",
    "thirdTrigger",
    "fourthTrigger",
    "fifthTrigger",
    "sixthTrigger",
  ];
  //setting up global map for client actions test data
  global["map"] = new Map<string, any>();
  console.log(
    "clientActionsInterceptorsTester::Triggering buttonPressed event to get client actions"
  );
  //looping on each field to trigger cpi-side related events -> these will trigger the corresponding client actions
  for (const button of interceptorsNamesArr) {
    console.log(
      `clientActionsInterceptorsTester::Started triggering ${button}`
    );
    const options = {
      EventKey: "TSAButtonPressed",
      EventData: JSON.stringify({
        FieldID: button,
      }),
    };
    //calling recursive function - event loop to run all client actions in existant for the current interceptor
    const clientAction = await clientActionsService.EmitClientEvent(
      webAPIBaseURL,
      accessToken,
      options
    );
    console.log(
      `clientActionsInterceptorsTester::Finished triggering ${button}`
    );
  }
  await service.setTestFlag({ InterceptorActionsTest: false });
  // debugger;
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.sleep(2000);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(10000);
  const udtData = await service.getUDTValues("actionsSequence", 1, "DESC");
  //getting actions back from global map after client actions responses (event loop finished)
  const actions = global["map"] as Map<string, any>; //key - client action UUID,value - data
  // debugger;
  const arrActions: any[] = [];
  for (const action of actions) {
    arrActions.push(action);
  }
  console.log(arrActions);
  const dialogSequenceArr: any[] = [];
  for (let i = 0; i < actions.size; i++) {
    const actionData = await clientActionsService.parseActionDataForTest(
      arrActions[i][1]
    );
    dialogSequenceArr.push(actionData);
  }
  console.log(udtData);

  try {
    const res = await service.updateUDTValues(
      udtData[0].MapDataExternalID,
      udtData[0].MainKey,
      udtData[0].SecondaryKey,
      true
    );
    console.log(
      `clientActionsInterceptorsTester::Updated UDTLineID ${udtData[0].InternalID},with the following hidden status: ${res.Hidden} `
    );
  } catch (err) {
    console.log(`clientActionsInterceptorsTester:: UDT removal error: ${err}`);
  }

  describe("Client Actions Automation positive test", async () => {
    for (const [key, value] of actions) {
      const Object = JSON.parse(value);
      const parsedActionData: ClientAction = JSON.parse(Object.Value);
      const Type = parsedActionData.Type;
      let Title = "";

      switch (Type) {
        case "Dialog":
          Title = parsedActionData.Data.Title;
          it(`Client Actions Automation - ${Type} - ${Title}`, async () => {
            switch (Title) {
              //alert test
              case "alert":
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("alert");
                expect(
                  parseInt(parsedActionData.Data.Content),
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("number")
                  .that.is.above(0);
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(1);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Ok");
                break;
              //confirm test
              case "confirm":
                expect(
                  parsedActionData.Data.Title,
                  "Failed on title returning wrong value/type"
                )
                  .to.be.a("string")
                  .that.is.equal("confirm");
                expect(
                  parseInt(parsedActionData.Data.Content),
                  "Failed on content returning wrong value/type"
                )
                  .to.be.a("number")
                  .to.satisfy(function (num) { return (num > 0 || num === -1); });
                expect(
                  parsedActionData.Data.Actions,
                  "Failed on actions not returning as an array"
                )
                  .to.be.an("array")
                  .with.lengthOf(2);
                expect(
                  parsedActionData.Data.Actions[0],
                  "Failed on Actions[0] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[0].Key,
                  "Failed on Actions[0].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[0].Title,
                  "Failed on Actions[0].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Ok");
                expect(
                  parsedActionData.Data.Actions[1],
                  "Failed on Actions[1] not being an object"
                ).to.be.an("object").that.is.not.null.and.undefined;
                expect(
                  parsedActionData.Data.Actions[1].Key,
                  "Failed on Actions[1].key not being a string"
                )
                  .to.be.an("string")
                  .that.has.lengthOf(36);
                expect(
                  parsedActionData.Data.Actions[1].Title,
                  "Failed on Actions[1].title having the wrong value/type"
                )
                  .to.be.an("string")
                  .that.is.equal("Cancel");
                break;
            }
          });
          break;
        case "GeoLocation":
          Title = parsedActionData.Data.Accuracy; //getting filter to test according to Accuracy
          it(`Client Actions Automation - ${Type} - ${Title}`, async () => {
            expect(
              parsedActionData,
              "Failed on actions data returning with the wrong type"
            ).to.be.an("object").that.is.not.undefined.and.null;
            expect(
              parsedActionData.Type,
              "Failed on CaptureGeo client action returning the wrong type"
            )
              .to.be.a("string")
              .that.is.equal("GeoLocation");
            expect(
              parsedActionData.Callback,
              "Failed on callback returning wrong value/type"
            )
              .to.be.a("string")
              .that.has.lengthOf(36);
            switch (Title) {
              case "Medium":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("Medium");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(400);
                break;
              case "High":
                expect(
                  parsedActionData.Data.Accuracy,
                  "Failed on Accuracy returning wrong value"
                )
                  .to.be.a("string")
                  .that.is.equal("High");
                expect(
                  parsedActionData.Data.MaxWaitTime,
                  "Failed on MaxWaitTime returning the wrong value"
                )
                  .to.be.a("number")
                  .that.is.equal(1000);
                break;
            }
          });
          break;
      }
    }
    it(`Client Actions Automation - Parsed execution sequence results`, async () => {
      const arr = udtData[0].Values[0].split(",");
      debugger;
      const geoData = {
        lat: arr[24].split(":"),
        acc: arr[25].split(":"),
      };
      expect(arr[0]).to.be.a("string").that.is.equal("1");
      expect(arr[1]).to.be.a("string").that.is.equal("true");
      expect(arr[2]).to.be.a("string").that.is.equal("2");
      expect(arr[3]).to.be.a("string").that.is.equal("3");
      expect(arr[4]).to.be.a("string").that.is.equal("undefind");
      expect(arr[5]).to.be.a("string").that.is.equal("4");
      expect(arr[6]).to.be.a("string").that.is.equal("5");
      expect(arr[7]).to.be.a("string").that.is.equal("6");
      expect(arr[8]).to.be.a("string").that.is.equal("7");
      expect(arr[9]).to.be.a("string").that.is.equal("undefind");
      expect(arr[10]).to.be.a("string").that.is.equal("8");
      expect(arr[11]).to.be.a("string").that.is.equal("9");
      expect(arr[12]).to.be.a("string").that.is.equal("true");
      expect(arr[13]).to.be.a("string").that.is.equal("10");
      expect(arr[14]).to.be.a("string").that.is.equal("11");
      expect(arr[15]).to.be.a("string").that.is.equal("true");
      expect(arr[16]).to.be.a("string").that.is.equal("12");
      expect(arr[17]).to.be.a("string").that.is.equal("13");
      expect(arr[18]).to.be.a("string").that.is.equal("14");
      expect(arr[19]).to.be.a("string").that.is.equal("15");
      expect(arr[21]).to.be.a("string").that.is.equal("undefind");
      expect(arr[22]).to.be.a("string").that.is.equal("16"); // need to change to 16
      expect(arr[23]).to.be.a("string").that.is.equal(`{"success":true`);
      expect(geoData.lat[0]).to.be.a("string").that.is.equal(`"latitude"`);
      expect(parseFloat(geoData.lat[1])).to.be.a("number").that.is.above(1);
      expect(geoData.acc[0]).to.be.a("string").that.is.equal(`"accuracy"`);
      expect(parseFloat(geoData.acc[1].replace("}", "")))
        .to.be.a("number")
        .that.is.above(1);

      for (let i = 0; i < dialogSequenceArr.length; i++) {
        const index = parseInt(dialogSequenceArr[i].Data.Content);
        if (index !== -1)
          expect(
            index,
            `Failed on sequence returning ${index} instead of ${i + 1}`
          )
            .to.be.a("number")
            .that.is.equal(i + 1);
      }
    });
  });

  console.log("clientActionsInterceptorsTester::Test Finished");
  const testResults = await run();
  return testResults;
}
//=====================Notifications==========================================
export async function notificationsPositive(client: Client, request: Request) {
  console.log(`notificationsPositive::Test Started`);
  const service = new MyService(client);
  const notificationService = new NotificationService(client);
  const { describe, it, expect, run } = Tester();
  console.log(`notificationsPositive::Gotten services,initiating requests`);
  //userDevice
  const userDeviceObj = await notificationService.generateUserDevice();

  const userDevicePost = await notificationService.postUserDevice(
    userDeviceObj
  );

  const userDeviceKey = userDevicePost.Key as string;

  const userDeviceGet = await notificationService.getUserDeviceByKey(
    userDeviceKey
  );
  //notifications
  const notificationObj =
    await notificationService.generateRandomNotification();

  const notificationPost = await notificationService.postNotifications(
    notificationObj
  );
  //can test the post object against the original object;
  const notificationKey = notificationPost.Key as string;

  const notificationGet = await notificationService.getNotificationByKey(
    notificationKey
  );

  //get push from ADAL
  const today = new Date().toISOString().split("T")[0];
  const userUUID = notificationObj.UserUUID;
  const title = notificationObj.Title;
  const body = notificationObj.Body;
  const notificationKeyInADAL =
    userUUID + "_" + title + "_" + body + "_" + today;
  console.log(notificationKeyInADAL);
  await service.sleep(90000); //1 minutes wait till ADAL insert is done - triggered by notification insert
  const notificationFromADAL = await service.getFromADAL(
    "NotificationsLogger",
    notificationKeyInADAL
  );
  //Mark as read
  const markAsReadObj = {
    Read: true,
    Key: notificationKey,
  };
  const markRead = await notificationService.postNotifications(markAsReadObj);

  const notificationGetAfterRead =
    await notificationService.getNotificationByKey(notificationKey);
  //data cleansing
  userDeviceObj.Hidden = true;
  const removeUserDevice = await notificationService.postUserDevice(
    userDeviceObj
  );

  notificationFromADAL[0].Hidden = true;
  const removeNotificationFromADAL = await service.upsertToADAL(
    "NotificationsLogger",
    notificationFromADAL[0]
  );

  console.log(
    "notificationsPositive:: removed objects,posting notifications with email"
  );

  //notifications with email instead of userUUID - does not test push
  const notificationObjWithEmail =
    await notificationService.generateRandomNotificationWithEmail();
  const notificationPostWithEmail = await notificationService.postNotifications(
    notificationObjWithEmail
  );
  //can test the post object against the original object;
  const notificationKeyWithEmail = notificationPostWithEmail.Key as string;

  const notificationGetWithEmail =
    await notificationService.getNotificationByKey(notificationKeyWithEmail);

  //notifications removal
  const removalBody = {
    Key: notificationKey,
    Hidden: true,
  };
  const removalWithEmailBody = {
    Key: notificationKeyWithEmail,
    Hidden: true,
  };
  const firstRemoval = await notificationService.postNotifications(removalBody);
  const secondRemoval = await notificationService.postNotifications(
    removalWithEmailBody
  );
  //some mocha to test if the Original + POSTED + Gotten objects are the same
  console.log(`notificationsPositive::Starting Mocha tests`);

  describe("Notifications Positive automation test", async () => {
    it("Post parsed test results", async () => {
      expect(
        notificationPost,
        "Failed on notification post returning wrong type"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        notificationPost.ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationPost.CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationPost.Read,
        "Failed on Read returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationPost.Title,
        "Failed on Title returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Title);
      expect(
        notificationPost.Body,
        "Failed on Body returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Body);
      expect(
        notificationPost.Hidden,
        "Failed on Hidden returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationPost.CreatorUUID,
        "Failed on CreatorUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationPost.UserUUID,
        "Failed on UserUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationPost.Key,
        "Failed on Key returning the wrong value/type"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);

      const ExpirationDate = new Date();
      const testExpirationDate =
        notificationPost.ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(testExpirationDate, "Failed on wrong expiration date returning")
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
    });

    it("Get parsed test results", async () => {
      expect(
        notificationGet[0],
        "Failed on notification get returning wrong type"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        notificationGet[0].ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationGet[0].CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationGet[0].Read,
        "Failed on Read returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationGet[0].Title,
        "Failed on Title returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Title);
      expect(
        notificationGet[0].Body,
        "Failed on Body returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Body);
      expect(
        notificationGet[0].Hidden,
        "Failed on Hidden returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationGet[0].CreatorUUID,
        "Failed on CreatorUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationGet[0].UserUUID,
        "Failed on UserUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationGet[0].Key,
        "Failed on Key returning the wrong value/type"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);

      const ExpirationDate = new Date();
      const testExpirationDate =
        notificationGet[0].ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(testExpirationDate, "Failed on wrong expiration date returning")
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
    });

    it("mark_as_read parsed test results", async () => {
      expect(
        markRead,
        "Failed on markAsRead get returning wrong type"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        markRead.ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        markRead.CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        markRead.Read,
        "Failed on Read returning false instead of true"
      ).to.be.a("boolean").that.is.true;
      expect(markRead.Title, "Failed on Title returning the wrong value/type")
        .to.be.a("string")
        .that.is.equal(notificationObj.Title);
      expect(markRead.Body, "Failed on Body returning the wrong value/type")
        .to.be.a("string")
        .that.is.equal(notificationObj.Body);
      expect(
        markRead.Hidden,
        "Failed on Hidden returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        markRead.CreatorUUID,
        "Failed on CreatorUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        markRead.UserUUID,
        "Failed on UserUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(markRead.Key, "Failed on Key returning the wrong value/type")
        .to.be.a("string")
        .that.has.lengthOf(36);

      const ExpirationDate = new Date();
      const testExpirationDate = markRead.ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(testExpirationDate, "Failed on wrong expiration date returning")
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
    });

    it("Get after mark_as_read Parsed test results", async () => {
      expect(
        notificationGetAfterRead[0],
        "Failed on notificationGetAfterRead[0] get returning wrong type"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        notificationGetAfterRead[0].ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24)
        .and.not.to.be.equal(notificationGet.ModificationDateTime);
      expect(
        notificationGetAfterRead[0].CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationGetAfterRead[0].Read,
        "Failed on Read returning false instead of true"
      ).to.be.a("boolean").that.is.true;
      expect(
        notificationGetAfterRead[0].Title,
        "Failed on Title returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Title);
      expect(
        notificationGetAfterRead[0].Body,
        "Failed on Body returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Body);
      expect(
        notificationGetAfterRead[0].Hidden,
        "Failed on Hidden returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationGetAfterRead[0].CreatorUUID,
        "Failed on CreatorUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationGetAfterRead[0].UserUUID,
        "Failed on UserUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationGetAfterRead[0].Key,
        "Failed on Key returning the wrong value/type"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);

      const ExpirationDate = new Date();
      const testExpirationDate =
        notificationGetAfterRead[0].ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(testExpirationDate, "Failed on wrong expiration date returning")
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
    });

    it("Push notification from ADAL Parsed test results", async () => {
      expect(
        notificationFromADAL[0].ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationFromADAL[0].CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationFromADAL[0].Endpoint,
        "Failed on notificationFromADAL.Endpoint returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AddonRelativeURL).and.is.not.null.and
        .undefined;
      expect(
        notificationFromADAL[0].Key,
        "Failed on notificationFromADAL.Key returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(notificationKeyInADAL).and.is.not.null.and.undefined;

      expect(
        notificationFromADAL[0].DeviceType,
        "Failed on notificationFromADAL.DeviceType returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceType).and.is.not.null.and.undefined;
      expect(
        notificationFromADAL[0].Hidden,
        "Failed on notificationFromADAL.Hidden returning wrong value"
      ).to.be.a("boolean").that.is.true.and.is.not.null.and.undefined;
      expect(
        notificationFromADAL[0].PlatformType,
        "Failed on notificationFromADAL.PlatformType returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.PlatformType).and.is.not.null.and
        .undefined;

      expect(
        notificationFromADAL[0].Subject,
        "Failed on userDevice.Title returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Title).and.is.not.null.and.undefined;

      expect(
        notificationFromADAL[0].Message,
        "Failed on userDevice.Body returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.Body).and.is.not.null.and.undefined;
    });

    it("Post with Email instead of userUUID parsed test results", async () => {
      expect(
        notificationPostWithEmail,
        "Failed on notification post returning wrong type"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        notificationPostWithEmail.ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationPostWithEmail.CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationPostWithEmail.Read,
        "Failed on Read returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationPostWithEmail.Title,
        "Failed on Title returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObjWithEmail.Title);
      expect(
        notificationPostWithEmail.Body,
        "Failed on Body returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObjWithEmail.Body);
      expect(
        notificationPostWithEmail.Hidden,
        "Failed on Hidden returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationPostWithEmail.CreatorUUID,
        "Failed on CreatorUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationPostWithEmail.UserUUID,
        "Failed on UserUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationPostWithEmail.Key,
        "Failed on Key returning the wrong value/type"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);

      const ExpirationDate = new Date();
      const testExpirationDate =
        notificationPostWithEmail.ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(testExpirationDate, "Failed on wrong expiration date returning")
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
    });

    it("Get with Email instead of userUUID parsed test results", async () => {
      expect(
        notificationGetWithEmail[0],
        "Failed on notification get returning wrong type"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        notificationGetWithEmail[0].ModificationDateTime,
        "Failed on modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationGetWithEmail[0].CreationDateTime,
        "Failed on CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      expect(
        notificationGetWithEmail[0].Read,
        "Failed on Read returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationGetWithEmail[0].Title,
        "Failed on Title returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObjWithEmail.Title);
      expect(
        notificationGetWithEmail[0].Body,
        "Failed on Body returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObjWithEmail.Body);
      expect(
        notificationGetWithEmail[0].Hidden,
        "Failed on Hidden returning true instead of false"
      ).to.be.a("boolean").that.is.false;
      expect(
        notificationGetWithEmail[0].CreatorUUID,
        "Failed on CreatorUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationGetWithEmail[0].UserUUID,
        "Failed on UserUUID returning the wrong value/type"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID);
      expect(
        notificationGetWithEmail[0].Key,
        "Failed on Key returning the wrong value/type"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);

      const ExpirationDate = new Date();
      const testExpirationDate =
        notificationGetWithEmail[0].ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(testExpirationDate, "Failed on wrong expiration date returning")
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
    });
  });
  describe("userDevice Positive automation test", async () => {
    it("Post parsed test results", async () => {
      expect(
        userDevicePost,
        "Failed on userDevicePost returning wrong type/value"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        userDevicePost.Key,
        "Failed on userDevice.Key returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(`${userDeviceObj.DeviceKey}_${userDeviceObj.AppKey}`).and
        .is.not.null.and.undefined;
      expect(
        userDevicePost.AddonRelativeURL,
        "Failed on userDevice.AddonRelativeURL returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AddonRelativeURL).and.is.not.null.and
        .undefined;
      expect(
        userDevicePost.AppName,
        "Failed on userDevice.AppName returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AppName).and.is.not.null.and.undefined;
      expect(
        userDevicePost.AppKey,
        "Failed on userDevice.AppKey returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AppKey).and.is.not.null.and.undefined;
      expect(
        userDevicePost.DeviceKey,
        "Failed on userDevice.DeviceKey returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceKey).and.is.not.null.and.undefined;
      expect(
        userDevicePost.DeviceName,
        "Failed on userDevice.DeviceName returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceName).and.is.not.null.and.undefined;
      expect(
        userDevicePost.DeviceType,
        "Failed on userDevice.DeviceType returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceType).and.is.not.null.and.undefined;
      expect(
        userDevicePost.Hidden,
        "Failed on userDevice.Hidden returning wrong value"
      ).to.be.a("boolean").that.is.false.and.is.not.null.and.undefined;
      expect(
        userDevicePost.PlatformType,
        "Failed on userDevice.PlatformType returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.PlatformType).and.is.not.null.and
        .undefined;
      expect(
        userDevicePost.UserUUID,
        "Failed on userDevice.UserUUID returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID).and.is.not.null.and.undefined;
      expect(
        userDevicePost.ModificationDateTime,
        "Failed on userDevice.modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
      const ExpirationDate = new Date();
      const testExpirationDate =
        userDevicePost.ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(
        testExpirationDate,
        "Failed on userDevice.ExpirationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
      expect(
        userDevicePost.CreationDateTime,
        "Failed on userDevice.CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
    });
    it("Get parsed test results", async () => {
      expect(
        userDeviceGet[0],
        "Failed on userDeviceGET returning wrong type/value"
      ).to.be.an("object").that.is.not.empty.and.undefined;
      expect(
        userDeviceGet[0].Key,
        "Failed on userDevice.Key returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(`${userDeviceObj.DeviceKey}_${userDeviceObj.AppKey}`).and
        .is.not.null.and.undefined;
      expect(
        userDeviceGet[0].AddonRelativeURL,
        "Failed on userDevice.AddonRelativeURL returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AddonRelativeURL).and.is.not.null.and
        .undefined;
      expect(
        userDeviceGet[0].AppName,
        "Failed on userDevice.AppName returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AppName).and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].AppKey,
        "Failed on userDevice.AppKey returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.AppKey).and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].DeviceKey,
        "Failed on userDevice.DeviceKey returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceKey).and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].DeviceName,
        "Failed on userDevice.DeviceName returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceName).and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].DeviceType,
        "Failed on userDevice.DeviceType returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.DeviceType).and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].Hidden,
        "Failed on userDevice.Hidden returning wrong value"
      ).to.be.a("boolean").that.is.false.and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].PlatformType,
        "Failed on userDevice.PlatformType returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(userDeviceObj.PlatformType).and.is.not.null.and
        .undefined;
      expect(
        userDeviceGet[0].UserUUID,
        "Failed on userDevice.UserUUID returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(notificationObj.UserUUID).and.is.not.null.and.undefined;
      expect(
        userDeviceGet[0].ModificationDateTime,
        "Failed on userDevice.modificationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);

      const ExpirationDate = new Date();
      const testExpirationDate =
        userDeviceGet[0].ExpirationDateTime?.split("T")[0];
      ExpirationDate.setDate(ExpirationDate.getDate() + 30);
      const ExpirationDateToText = ExpirationDate.toISOString().split("T")[0];

      expect(
        testExpirationDate,
        "Failed on userDevice.ExpirationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.is.equal(ExpirationDateToText);
      expect(
        userDeviceGet[0].CreationDateTime,
        "Failed on userDevice.CreationDateTime returning wrong type/value"
      )
        .to.be.a("string")
        .that.has.lengthOf(24);
    });
  });
  console.log(`notificationsPositive::Test Ended`);
  // return {
  //   Base: notificationObj,
  //   Post: notificationPost,
  //   Get: notificationGet,
  //   mark_as_read: markAsRead,
  //   GetAfterRead: notificationGetAfterRead,
  // };

  const testResults = await run();
  return testResults;
}

export async function bulkNotificationTester(client: Client, request: Request) {
  console.log(`bulkNotificationTester::Test Started`);
  const service = new MyService(client);
  const notificationService = new NotificationService(client);
  const { describe, it, expect, run } = Tester();
  const userDeviceArr: userDevice[] = [];

  for (let i = 0; i < 10; i++) {
    const userDeviceObj = await notificationService.generateUserDevice(
      "TEST",
      false,
      "/addons/api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/api/bulkNotificationsLogger"
    );

    const userDevicePost = await notificationService.postUserDevice(
      userDeviceObj
    );
    userDeviceArr.push(userDeviceObj);
  }

  //notifications
  const notificationObj =
    await notificationService.generateRandomNotification();

  const notificationPost = await notificationService.postNotifications(
    notificationObj
  );
  console.log(notificationPost);

  await service.sleep(360000);

  for (const device of userDeviceArr) {
    device.Hidden = true;
    const userDevicePost = await notificationService.postUserDevice(device);
  }

  const notificationRemovalObj = {
    Key: notificationPost.Key,
    Hidden: true,
  };

  const notificationRemovalPost = await notificationService.postNotifications(
    notificationRemovalObj
  );

  const dateTime = new Date().toISOString();
  const notificationFromADAL = await service.getFromADALByDate(
    "NotificationsLogger",
    dateTime
  );
  console.log(notificationFromADAL);

  for (const notification of notificationFromADAL) {
    notification.Hidden = true;
    const res = await service.upsertToADAL("NotificationsLogger", notification);
    console.log(res);
  }

  describe("bulkNotifications automation test", async () => {
    it("Post parsed test results", async () => {
      expect(
        notificationFromADAL,
        `Failed on returning the wrong number of push messages,instead of 10 only ${notificationFromADAL.length} returned`
      )
        .to.be.an("array")
        .that.has.lengthOf(10).that.is.not.empty.and.undefined;
      expect(
        userDeviceArr,
        `Failed on returning the wrong number of userDevices,instead of 10 only ${userDeviceArr.length} returned`
      )
        .to.be.an("array")
        .that.has.lengthOf(10).that.is.not.empty.and.undefined;
    });
  });
  console.log(`bulkNotificationTester::Test Ended`);

  const testResults = await run();
  return testResults;
}
//the below doesn't work due to DI-20789 - Posting bulk notifications returns exception
export async function multiNotificationsAndUsersTester(
  client: Client,
  request: Request
) {
  console.log(`multiNotificationsAndUsersTester::Test Started`);
  const service = new MyService(client);
  const notificationService = new NotificationService(client);
  const { describe, it, expect, run } = Tester();

  const userDeviceObjArr = await notificationService.generateBulkUserDevice();
  const userDeviceArr: userDevice[] = [];
  const notificationArr: Notification[] = [];
  for (const device of userDeviceObjArr) {
    const userDevicePost = await notificationService.postUserDevice(device);
    userDeviceArr.push(userDevicePost);
  }
  const notificationsKeys: string[] = [];

  const bulkNotificationsObj =
    await notificationService.generateRandomBulkNotifications();
  console.log(bulkNotificationsObj);
  const post = await notificationService.postBulkNotification(
    bulkNotificationsObj
  );
  console.log(post);

  for (const res of post) {
    notificationsKeys.push(res.Key as string);
  }

  for (const key of notificationsKeys) {
    const notification = await notificationService.getNotificationByKey(key);
    notificationArr.push(notification[0]);
  }
  console.log(notificationArr);

  await service.sleep(300000);
  const dateTime = new Date().toISOString();
  const notificationFromADAL = await service.getFromADALByDate(
    "NotificationsLogger",
    dateTime
  );
  console.log(notificationFromADAL);

  for (const device of userDeviceObjArr) {
    device.Hidden = true;
    const userDevicePost = await notificationService.postUserDevice(device);
  }

  for (const key of notificationsKeys) {
    const body = {
      Key: key,
      Hidden: true,
    };
    const removal = await notificationService.postNotifications(body);
  }

  for (const notification of notificationFromADAL) {
    notification.Hidden = true;
    const res = await service.upsertToADAL("NotificationsLogger", notification);
    console.log(res);
  }

  describe("multiNotificationsAndUsersTester Positive automation test", async () => {
    it("Post response parsed test results", async () => {
      for (let bulkNotification of post) {
        expect(bulkNotification.Key, "Failed on key returning wrong type/value")
          .to.be.a("string")
          .that.has.lengthOf(36).and.is.not.undefined.and.empty;
        expect(
          bulkNotification.Status,
          "Failed on Status returning wrong type/value"
        )
          .to.be.a("string")
          .that.is.equal("Insert").and.is.not.undefined.and.empty;
      }
    });
    it("Notification data parsed test results", async () => {
      for (let notification of notificationArr) {
        expect(
          notification.CreationDateTime,
          "Failed on returning wrong CreationDateTime"
        ).to.include(new Date().toISOString().split("T")[0]);
        expect(
          notification.CreationDateTime,
          "Failed on returning wrong CreationDateTime"
        ).to.include("Z");
        expect(
          notification.ModificationDateTime,
          "Failed on returning wrong ModificationDateTime"
        ).to.include(new Date().toISOString().split("T")[0]);
        expect(
          notification.ModificationDateTime,
          "Failed on returning wrong ModificationDateTime"
        ).to.include("Z");
        expect(notification.Hidden, "Failed on returning wrong Hidden").that.is
          .false.and.is.not.undefined;
        if (bulkNotificationsObj.Title === notification.Title) {
          expect(notification.Title, "Failed on returning wrong Title")
            .to.be.a("string")
            .that.is.equal(bulkNotificationsObj.Title).and.is.not.empty.and
            .undefined;
        }
        if (bulkNotificationsObj.Body === notification.Body) {
          expect(notification.Body, "Failed on returning wrong Body")
            .to.be.a("string")
            .that.is.equal(bulkNotificationsObj.Body).and.is.not.empty.and
            .undefined;
        }

        for (let userDevice of userDeviceArr) {
          if (userDevice.UserUUID === notification.UserUUID) {
            expect(notification.UserUUID, "Failed on returning wrong userUUID")
              .to.be.a("string")
              .that.is.equal(userDevice.UserUUID).and.is.not.empty.and
              .undefined;
          }
        }
        for (let push of notificationFromADAL) {
          expect(
            notificationFromADAL,
            "Failed on push array returning wrong number of objects"
          )
            .to.be.an("array")
            .with.lengthOf(4);
          expect(push.Endpoint, "Failed on wrong endpoint returning")
            .to.be.a("string")
            .that.is.equal(
              "/addons/api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/api/bulkNotificationsLogger"
            );
          expect(push.Hidden, "Failed on wrong Hidden returning").to.be.a(
            "boolean"
          ).that.is.true;
          expect(push.PlatformType, "Failed on wrong platformType returning")
            .to.be.a("string")
            .that.is.equal("Addon");
          expect(push.DeviceType, "Failed on wrong DeviceType returning")
            .to.be.a("string")
            .that.is.equal("Test");
          expect(
            push.CreationDateTime,
            "Failed on returning wrong CreationDateTime"
          ).to.include(new Date().toISOString().split("T")[0]);
          expect(
            push.CreationDateTime,
            "Failed on returning wrong CreationDateTime"
          ).to.include("Z");
          expect(
            push.ModificationDateTime,
            "Failed on returning wrong ModificationDateTime"
          ).to.include(new Date().toISOString().split("T")[0]);
          expect(
            push.ModificationDateTime,
            "Failed on returning wrong ModificationDateTime"
          ).to.include("Z");
          if (push.Subject === notification.Title) {
            expect(push.Subject, "Failed on wrong Subject returning")
              .to.be.a("string")
              .that.is.equal(notification.Title);
          }
          if (push.Message === notification.Body) {
            expect(push.Message, "Failed on wrong Message returning")
              .to.be.a("string")
              .that.is.equal(notification.Body);
          }
        }
      }
    });
  });

  //need to add test cases for mark_as_read
  const testResults = await run();
  return testResults;
}

export async function notificationsNegative(client: Client, request: Request) {
  console.log(`notificationsNegative::Test Started`);
  //const service = new MyService(client);
  const notificationService = new NotificationService(client);
  const { describe, it, expect, run } = Tester();
  console.log(`notificationsNegative::Gotten services,initiating requests`);
  //remarked sections are sections for bugs/future changes
  const user = await notificationService.papiClient.users.find({
    where: `ExternalID='TEST'`, // a user with this ID should be created on addons intall
  });
  const userUUID = user[0].UUID as string;
  const userEmail = user[0].Email as string;

  describe("Notifications Negative automation test", async () => {
    it("notifications Post negative tests", async () => {
      console.log("notificationsNegative::starting notifications tests");
      try {
        const notificationObj1 =
          await notificationService.generateNegativeNotification(
            "Title-number",
            userUUID
          );
        const notificationWithNumberTitle =
          await notificationService.postNotificationsNegative(notificationObj1);
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on Title sent as number returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Title is not of a type(s) string","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }
      try {
        const notificationObj2 =
          await notificationService.generateNegativeNotification(
            "longTitle",
            userUUID
          );
        const notificationWithNoBody =
          await notificationService.postNotificationsNegative(notificationObj2);
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on Title sent length returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Title does not meet maximum length of 40","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }
      try {
        const notificationObj3 =
          await notificationService.generateNegativeNotification(
            "Body-number",
            userUUID
          );
        const notificationWithNumberBody =
          await notificationService.postNotificationsNegative(notificationObj3);
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on Body sent as number returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Body is not of a type(s) string","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }
      try {
        const notificationObj4 =
          await notificationService.generateNegativeNotification(
            "User-removed",
            userUUID
          );
        const notificationWithNoUser =
          await notificationService.postNotificationsNegative(notificationObj4);
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on empty UserUUID sent returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Exactly one of the following properties is required: UserUUID,UserEmail","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }
      try {
        const notificationObj5 =
          await notificationService.generateNegativeNotification(
            "User-number",
            userUUID
          );
        const notificationWithNumberUser =
          await notificationService.postNotificationsNegative(notificationObj5);
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on number UserUUID sent returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: UserUUID is not of a type(s) string\\nExactly one of the following properties is required: UserUUID,UserEmail","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }
      try {
        const notificationObj9 =
          await notificationService.generateNegativeNotification(
            "all-wrong",
            userUUID
          );
        const notificationWithAllWrong =
          await notificationService.postNotificationsNegative(notificationObj9);
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on all wrong parameters sent returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Title is not of a type(s) string\\nBody is not of a type(s) string\\nUserUUID is not of a type(s) string\\nExactly one of the following properties is required: UserUUID,UserEmail","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }

      try {
        const notificationObj10 =
          await notificationService.generateNegativeNotification(
            "longBody",
            userUUID
          );
        const notificationWithNoBody =
          await notificationService.postNotificationsNegative(
            notificationObj10
          );
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on Body sent length returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              'https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Body does not meet maximum length of 200","detail":{"errorcode":"BadRequest"}}}'
            )
          : null;
      }

      try {
        const notificationObj11 =
          await notificationService.generateNegativeNotification(
            "wrong-email",
            userUUID,
            userEmail
          );
        const notificationWithInvalidEmail =
          await notificationService.postNotificationsNegative(
            notificationObj11
          );
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on sending wrong user email returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              `https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: User with Email: notifications@pepperitest does not exist","detail":{"errorcode":"BadRequest"}}}`
            )
          : null;
      }
      try {
        const notificationObj12 =
          await notificationService.generateNegativeNotification(
            "uuid-email",
            userUUID,
            userEmail
          );
        const notificationWithEmailnUUID =
          await notificationService.postNotificationsNegative(
            notificationObj12
          );
      } catch (e) {
        e instanceof Error
          ? expect(
            e.message,
            "Failed on sending userUUID + email returning wrong exception"
          )
            .to.be.a("string")
            .that.is.equal(
              `https://papi.staging.pepperi.com/V1.0/push_notifications failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: Exactly one of the following properties is required: UserUUID,UserEmail","detail":{"errorcode":"BadRequest"}}}`
            )
          : null;
      }
      console.log("notificationsPositive::finished notifications tests");
    });
    //Need to talk to Chasky regarding the below
    it("userDevice negative tests", async () => {
      try {
      } catch (e) { }
    });
  });
  console.log(`notificationsPositive::Test Finished`);
  //need to add test cases for mark_as_read
  const testResults = await run();
  return testResults;
}
//Listener endpoints that gets the notifications for the automation
export async function notificationsLogger(client: Client, request: Request) {
  console.log(`notificationsLogger::Inside notificationsLogger`);
  let reqBody = request.body; // catch notification userDevice response
  // need to push notification into ADAL
  const service = new MyService(client);
  const user = await service.papiClient.users.find({
    where: `ExternalID='TEST'`,
  });
  console.log(reqBody);
  const date = new Date().toISOString().split("T")[0] as string;
  reqBody.Key = `${user[0].UUID}_${reqBody.Subject}_${reqBody.Message}_${date}`;
  console.log(
    `notificationsLogger::ADAL request body: ${JSON.stringify(reqBody)}`
  );

  const upsert = await service.upsertToADAL("NotificationsLogger", reqBody);

  console.log(
    `notificationsLogger::ADAL request response: ${JSON.stringify(upsert)}`
  );

  return "success";
}

export async function bulkNotificationsLogger(
  client: Client,
  request: Request
) {
  console.log(`bulkNotificationsLogger::Inside notificationsLogger`);
  let reqBody = request.body; // catch notification userDevice response
  // need to push notification into ADAL
  const service = new MyService(client);
  const user = await service.papiClient.users.find({
    where: `ExternalID='TEST'`,
  });
  console.log(reqBody);
  const date = new Date().toISOString();
  reqBody.Key = `${user[0].UUID}_${reqBody.Message}_${date}`;
  console.log(
    `bulkNotificationsLogger::ADAL request body: ${JSON.stringify(reqBody)}`
  );

  const upsert = await service.upsertToADAL("NotificationsLogger", reqBody);

  console.log(
    `bulkNotificationsLogger::ADAL request response: ${JSON.stringify(upsert)}`
  );

  return "success";
}
//cleanse ADAL table if needed
export async function cleanseADAL(client: Client, request: Request) {
  const service = new MyService(client);
  const resultArr: any[] = [];
  const date = new Date().toISOString();
  //const res = await service.getFromADALByDate("NotificationsLogger", date);
  const res = await service.getAllFromADAL("syncTable");

  for (const obj of res) {
    obj.Hidden = true;
    const res = await service.upsertToADAL("syncTable", obj);
    resultArr.push(res);
  }
  return resultArr;
}
//======================================Sync========================================
export async function SyncWithAuditLog(client: Client, request: Request) {
  console.log(`SyncWithAuditLog::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const scheme = await syncService.getUDCScheme();
  const tableName = scheme[0].Name;
  const { describe, it, expect, run } = Tester();
  console.log(`SyncWithAuditLog::Gotten services,initiating requests`);
  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 4,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: tableName,
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };
  const settings = await syncService.setSyncOptions(syncOptions);
  const date = new Date();
  await service.sleep(10000);
  const document = await syncService.generateDocument(11);
  const upsert = await syncService.upsertDocument(tableName, document); //collection hard-coded for now since it can't be removed
  await service.sleep(2000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });

  await service.sleep(20000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    50
  );
  console.log(auditLog);

  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  const testData = await syncService.validateResourceData(resultObject.ResourcesData, tableName);
  const schemeData = await syncService.validateResourceScheme(resultObject.ResourcesData, tableName);
  const allData = resultObject.ResourcesData;
  console.log(allData);
  const Objects = testData[0];
  const Schema = schemeData;


  Objects.Hidden = true;
  const upsertToHidden = await syncService.upsertDocument(tableName, Objects);
  console.log(`SyncWithAuditLog::Gotten all data objects,Starting Mocha tests`);

  describe("Sync with Audit Log automation test", async () => {
    it("Settings Post Test", async () => {
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });
    it("Sync Data - UDC Document insertion test", async () => {
      expect(allData, "Failed on sync returning more than one object - DI-20917").to.be.a("array").that.has.lengthOf(1);
      //uncomment when DI-20917 is resolved
      expect(Objects.testField1, "Failed on Field1 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(Objects.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(Objects.testField2, "Failed on Field2 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField2);
      expect(Objects.testField3, "Failed on Field3 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField3);
      expect(Objects.testField4, "Failed on Field4 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField4);
      expect(Objects.testField5, "Failed on Field5 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField5);
      expect(Objects.testField6, "Failed on Field6 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField6);
      expect(Objects.testField7, "Failed on Field7 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField7);
      expect(Objects.testField8, "Failed on Field8 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField8);
      expect(Objects.testField9, "Failed on Field9 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField9);
      expect(Objects.testField10, "Failed on Field10 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField10);
      expect(Objects.Hidden, "Failed on hidden returning wrong output").to.be.a(
        "boolean"
      ).that.is.true; // test is done after object is moved to hidden

      const CreationDate = Objects.CreationDateTime;
      const ModificationDate = Objects.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");
    });
    it("Sync Data - Schema", async () => {
      expect(Schema.AddonUUID, "Failed on UUID returning wrong output")
        .to.be.a("string")
        .that.is.equal("122c0e9d-c240-4865-b446-f37ece866c22");
      expect(Schema.Name, "Failed on Schema returning wrong output")
        .to.be.a("string")
        .that.is.equal(tableName);
      expect(
        Schema.SyncData.IndexedField,
        "Failed on indexed field returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD);
    });
  });

  console.log(`SyncWithAuditLog::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}

export async function SyncWithCPISideTest(client: Client, request: Request) {
  console.log(`SyncWithCPISideTest::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const scheme = await syncService.getUDCScheme();
  const tableName = scheme[0].Name;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const { describe, it, expect, run } = Tester();
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);
  console.log(`SyncWithCPISideTest::Gotten services,initiating requests`);
  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 4,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: tableName,
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };
  const settings = await syncService.setSyncOptions(syncOptions);
  const date = new Date();
  await service.sleep(10000);
  const document = await syncService.generateDocument(11);
  const upsert = await syncService.upsertDocument(tableName, document); //collection hard-coded for now since it can't be removed
  await service.sleep(2000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });
  await service.sleep(20000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    50
  );
  console.log(auditLog);

  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  const testData = await syncService.validateResourceData(resultObject.ResourcesData, tableName);
  const schemeData = await syncService.validateResourceScheme(resultObject.ResourcesData, tableName);
  const allData = resultObject.ResourcesData;
  const Objects = testData[0];
  const Schema = schemeData;

  await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);
  const key = document.testField1;
  console.log(key);
  await service.sleep(20000);
  const dataFromCPISide = await syncService.getDataFromCPISide(
    webAPIBaseURL,
    accessToken,
    tableName,
    key
  );
  console.log(dataFromCPISide);

  Objects.Hidden = true;
  const upsertToHidden = await syncService.upsertDocument(tableName, Objects);

  console.log(`SyncWithAuditLog::Gotten all data objects,Starting Mocha tests`);

  describe("Sync with Get from CPISide automation test", async () => {
    it("Settings Post Test", async () => {
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });
    it("Sync Data - UDC Document insertion test", async () => {
      expect(Objects.testField1, "Failed on Field1 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(Objects.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(Objects.testField2, "Failed on Field2 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField2);
      expect(Objects.testField3, "Failed on Field3 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField3);
      expect(Objects.testField4, "Failed on Field4 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField4);
      expect(Objects.testField5, "Failed on Field5 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField5);
      expect(Objects.testField6, "Failed on Field6 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField6);
      expect(Objects.testField7, "Failed on Field7 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField7);
      expect(Objects.testField8, "Failed on Field8 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField8);
      expect(Objects.testField9, "Failed on Field9 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField9);
      expect(Objects.testField10, "Failed on Field10 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField10);
      expect(Objects.Hidden, "Failed on hidden returning wrong output").to.be.a(
        "boolean"
      ).that.is.true; // test is done after object is moved to hidden

      const CreationDate = Objects.CreationDateTime;
      const ModificationDate = Objects.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");
    });
    it("Sync Data - Schema", async () => {
      expect(Schema.AddonUUID, "Failed on UUID returning wrong output")
        .to.be.a("string")
        .that.is.equal("122c0e9d-c240-4865-b446-f37ece866c22");
      expect(Schema.Name, "Failed on Schema returning wrong output")
        .to.be.a("string")
        .that.is.equal(tableName);
      expect(
        Schema.SyncData.IndexedField,
        "Failed on indexed field returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD);
    });
    it("Sync Data - Get from CPISide", async () => {
      expect(dataFromCPISide.success, "Failed on request failing").to.be.a(
        "boolean"
      ).that.is.true;
      expect(
        dataFromCPISide.object.testField1,
        "Failed on Field1 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(dataFromCPISide.object.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(
        dataFromCPISide.object.testField2,
        "Failed on Field2 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField2);
      expect(
        dataFromCPISide.object.testField3,
        "Failed on Field3 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField3);
      expect(
        dataFromCPISide.object.testField4,
        "Failed on Field4 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField4);
      expect(
        dataFromCPISide.object.testField5,
        "Failed on Field5 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField5);
      expect(
        dataFromCPISide.object.testField6,
        "Failed on Field6 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField6);
      expect(
        dataFromCPISide.object.testField7,
        "Failed on Field7 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField7);
      expect(
        dataFromCPISide.object.testField8,
        "Failed on Field8 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField8);
      expect(
        dataFromCPISide.object.testField9,
        "Failed on Field9 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField9);
      expect(
        dataFromCPISide.object.testField10,
        "Failed on Field10 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField10);
      expect(
        dataFromCPISide.object.Hidden,
        "Failed on hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;

      const CreationDate =
        dataFromCPISide.object.CreationDateTime;
      const ModificationDate =
        dataFromCPISide.object.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");
    });
  });

  console.log(`SyncWithCPISideTest::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}

export async function SyncWithIndexedField(client: Client, request: Request) {
  debugger;
  console.log(`SyncWithIndexedField::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const scheme = await syncService.getUDCScheme();
  const tableName = scheme[0].Name;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);
  const { describe, it, expect, run } = Tester();
  console.log(`SyncWithIndexedField::Gotten services,initiating requests`);
  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 4,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: tableName,
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "testField2",
  };
  const settings = await syncService.setSyncOptions(syncOptions);
  const date = new Date();
  await service.sleep(10000);

  const document = await syncService.generateIndexedDocument(11);
  const documentWithoutIndex = await syncService.generateDocument(11);
  const upsert = await syncService.upsertDocument(tableName, document); //collection hard-coded for now since it can't be removed
  const upsertWithOutIndex = await syncService.upsertDocument(
    tableName,
    documentWithoutIndex
  );
  await service.sleep(10000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });
  if (!sync.ExecutionURI) {
    throw ("no ExecutionURI returned from sync");
  }
  await service.sleep(20000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    50
  );

  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  //console.log(resultObject);
  const resData = resultObject.ResourcesData;

  const testScheme = await syncService.validateResourceScheme(resData, tableName);

  const testData = await syncService.validateResourceData(resData, tableName);


  const Objects = testData[0];

  const noneIndexedObjects = testData[1];


  const Schema = testScheme;

  await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);

  const index = document.testField2;


  await service.sleep(15000);
  const dataFromCPISide = await syncService.getListFromCPISide(
    webAPIBaseURL,
    accessToken,
    tableName,
    index
  );


  Objects.Hidden = true;
  noneIndexedObjects.Hidden = true;
  const upsertToHidden = await syncService.upsertDocument(tableName, Objects);
  const upsertNoneIndexToHidden = await syncService.upsertDocument(
    tableName,
    noneIndexedObjects
  );

  console.log(
    `SyncWithIndexedField::Gotten all data objects,Starting Mocha tests`
  );

  describe("SyncWithIndexedField from CPISide automation test", async () => {
    it("Settings Post Test", async () => {
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      expect(
        settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD,
        "Failed on wrong index field returning"
      )
        .to.be.a("string")
        .that.is.equal(syncOptions.USER_DEFINED_COLLECTIONS_INDEX_FIELD);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });
    it("Sync Data - UDC Document insertion test", async () => {
      expect(Objects.testField1, "Failed on Field1 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(Objects.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(Objects.testField2, "Failed on Field2 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField2);
      expect(Objects.testField3, "Failed on Field3 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField3);
      expect(Objects.testField4, "Failed on Field4 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField4);
      expect(Objects.testField5, "Failed on Field5 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField5);
      expect(Objects.testField6, "Failed on Field6 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField6);
      expect(Objects.testField7, "Failed on Field7 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField7);
      expect(Objects.testField8, "Failed on Field8 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField8);
      expect(Objects.testField9, "Failed on Field9 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField9);
      expect(Objects.testField10, "Failed on Field10 returning wrong output")
        .to.be.a("string")
        .that.is.equal(document.testField10);
      expect(Objects.Hidden, "Failed on hidden returning wrong output").to.be.a(
        "boolean"
      ).that.is.true; // test is done after object is moved to hidden

      const CreationDate = Objects.CreationDateTime;
      const ModificationDate = Objects.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");

      expect(
        noneIndexedObjects.testField1,
        "Failed on Field1 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField1);
      expect(noneIndexedObjects.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField1);
      expect(
        noneIndexedObjects.testField2,
        "Failed on Field2 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField2);
      expect(
        noneIndexedObjects.testField3,
        "Failed on Field3 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField3);
      expect(
        noneIndexedObjects.testField4,
        "Failed on Field4 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField4);
      expect(
        noneIndexedObjects.testField5,
        "Failed on Field5 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField5);
      expect(
        noneIndexedObjects.testField6,
        "Failed on Field6 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField6);
      expect(
        noneIndexedObjects.testField7,
        "Failed on Field7 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField7);
      expect(
        noneIndexedObjects.testField8,
        "Failed on Field8 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField8);
      expect(
        noneIndexedObjects.testField9,
        "Failed on Field9 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField9);
      expect(
        noneIndexedObjects.testField10,
        "Failed on Field10 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(documentWithoutIndex.testField10);
      expect(
        noneIndexedObjects.Hidden,
        "Failed on hidden returning wrong output"
      ).to.be.a("boolean").that.is.true; // test is done after object is moved to hidden

      const CreationDate2 = noneIndexedObjects.CreationDateTime?.split("T")[0];
      const ModificationDate2 =
        noneIndexedObjects.ModificationDateTime?.split("T")[0];

      expect(ModificationDate2, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate2, "Failed on wrong creation date")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });
    it("Sync Data - Schema", async () => {
      expect(Schema.AddonUUID, "Failed on UUID returning wrong output")
        .to.be.a("string")
        .that.is.equal("122c0e9d-c240-4865-b446-f37ece866c22");
      expect(Schema.Name, "Failed on Schema returning wrong output")
        .to.be.a("string")
        .that.is.equal(tableName);
      expect(
        Schema.SyncData.IndexedField,
        "Failed on indexed field returning wrong value"
      )
        .to.be.a("string")
        .that.is.equal(settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD);
    });
    it("Sync Data - GetList from CPISide", async () => {
      expect(
        dataFromCPISide.objects,
        "Failed on returning more than one object"
      )
        .to.be.a("array")
        .that.has.lengthOf(1);
      expect(dataFromCPISide.success, "Failed on request failing").to.be.a(
        "boolean"
      ).that.is.true;
      expect(
        dataFromCPISide.objects[0].testField1,
        "Failed on Field1 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(
        dataFromCPISide.objects[0].Key,
        "Failed on Key returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField1);
      expect(
        dataFromCPISide.objects[0].testField2,
        "Failed on Field2 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField2);
      expect(
        dataFromCPISide.objects[0].testField3,
        "Failed on Field3 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField3);
      expect(
        dataFromCPISide.objects[0].testField4,
        "Failed on Field4 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField4);
      expect(
        dataFromCPISide.objects[0].testField5,
        "Failed on Field5 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField5);
      expect(
        dataFromCPISide.objects[0].testField6,
        "Failed on Field6 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField6);
      expect(
        dataFromCPISide.objects[0].testField7,
        "Failed on Field7 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField7);
      expect(
        dataFromCPISide.objects[0].testField8,
        "Failed on Field8 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField8);
      expect(
        dataFromCPISide.objects[0].testField9,
        "Failed on Field9 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField9);
      expect(
        dataFromCPISide.objects[0].testField10,
        "Failed on Field10 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(document.testField10);
      expect(
        dataFromCPISide.objects[0].Hidden,
        "Failed on hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;

      const CreationDate =
        dataFromCPISide.objects[0].CreationDateTime;
      const ModificationDate =
        dataFromCPISide.objects[0].ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");
    });
  });

  console.log(`SyncWithIndexedField::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}

export async function SyncDataFromADAL(client: Client, request: Request) {
  console.log(`SyncDataFromADAL::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const tableName = "syncTable"; //change if you setup a new table
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const { describe, it, expect, run } = Tester();
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 40);
  console.log(`SyncDataFromADAL::Gotten services,initiating requests`);
  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 4,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };

  const settings = await syncService.setSyncOptions(syncOptions);
  const date = new Date();
  await service.sleep(10000);

  const object = await syncService.generateADALObj();
  console.log(object);

  const upsert = await service.upsertToADAL(tableName, object);

  await service.sleep(10000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });
  if (!sync.ExecutionURI) {
    throw ("TEST FAILED: no ExecutionURI returned from sync");
  }
  await service.sleep(20000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    50
  );

  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  const testData = await syncService.validateResourceData(resultObject.ResourcesData, tableName);
  const schemeData = await syncService.validateResourceScheme(resultObject.ResourcesData, tableName);
  const allData = resultObject.ResourcesData;
  console.log(allData);
  const Objects = testData[0];
  const Schema = schemeData;

  const key = object?.Key as string;
  await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);

  await service.sleep(15000);
  const dataFromCPISide = await syncService.getADALFromCPISide(
    webAPIBaseURL,
    accessToken,
    tableName,
    key
  );
  console.log(dataFromCPISide);

  Objects.Hidden = true;
  const upsertToHidden = await service.upsertToADAL(tableName, Objects);

  console.log(`SyncDataFromADAL::Gotten all data objects,Starting Mocha tests`);

  describe("Sync with Get from ADAL on CPISide automation test", async () => {
    it("Settings Post Test", async () => {
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      expect(
        settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD,
        "Failed on wrong index field returning"
      )
        .to.be.a("string")
        .that.is.equal(syncOptions.USER_DEFINED_COLLECTIONS_INDEX_FIELD);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });
    it("Sync Data - ADAL Document insertion test", async () => {
      expect(allData, "Failed on sync returning more than one scheme - DI-20917").to.be.an("array").that.has.lengthOf(1);
      expect(Objects.testField1, "Failed on Field1 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField1);
      expect(Objects.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField1);
      expect(Objects.testField2, "Failed on Field2 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField2);
      expect(Objects.testField3, "Failed on Field3 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField3);
      expect(Objects.testField4, "Failed on Field4 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField4);
      expect(Objects.testField5, "Failed on Field5 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField5);
      expect(Objects.testField6, "Failed on Field6 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField6);
      expect(Objects.testField7, "Failed on Field7 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField7);
      expect(Objects.testField8, "Failed on Field8 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField8);
      expect(Objects.testField9, "Failed on Field9 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField9);
      expect(Objects.testField10, "Failed on Field10 returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField10);
      expect(Objects.Hidden, "Failed on hidden returning wrong output").to.be.a(
        "boolean"
      ).that.is.true; // test is done after object is moved to hidden

      const CreationDate = Objects.CreationDateTime;
      const ModificationDate = Objects.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");
    });
    it("Sync Data - Schema", async () => {
      expect(Schema.AddonUUID, "Failed on UUID returning wrong output")
        .to.be.a("string")
        .that.is.equal("2b39d63e-0982-4ada-8cbb-737b03b9ee58");
      expect(Schema.Name, "Failed on Schema returning wrong output")
        .to.be.a("string")
        .that.is.equal(tableName);
      debugger;
      expect(
        Schema.SyncData.IndexedField,
        "Failed on indexed field returning wrong value"
      )
        .to.be.oneOf(["", undefined]);
    });
    it("Sync Data - Get ADAL key from CPISide", async () => {
      debugger;
      expect(
        dataFromCPISide.object,
        "Failed on returning wrong object type"
      ).to.be.a("object").that.is.not.empty.and.undefined;
      expect(dataFromCPISide.success, "Failed on request failing").to.be.a(
        "boolean"
      ).that.is.true;
      expect(
        dataFromCPISide.object.testField1,
        "Failed on Field1 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField1);
      expect(dataFromCPISide.object.Key, "Failed on Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(object.testField1);
      expect(
        dataFromCPISide.object.testField2,
        "Failed on Field2 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField2);
      expect(
        dataFromCPISide.object.testField3,
        "Failed on Field3 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField3);
      expect(
        dataFromCPISide.object.testField4,
        "Failed on Field4 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField4);
      expect(
        dataFromCPISide.object.testField5,
        "Failed on Field5 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField5);
      expect(
        dataFromCPISide.object.testField6,
        "Failed on Field6 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField6);
      expect(
        dataFromCPISide.object.testField7,
        "Failed on Field7 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField7);
      expect(
        dataFromCPISide.object.testField8,
        "Failed on Field8 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField8);
      expect(
        dataFromCPISide.object.testField9,
        "Failed on Field9 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField9);
      expect(
        dataFromCPISide.object.testField10,
        "Failed on Field10 returning wrong output"
      )
        .to.be.a("string")
        .that.is.equal(object.testField10);
      expect(
        dataFromCPISide.object.Hidden,
        "Failed on hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;

      const CreationDate =
        dataFromCPISide.object.CreationDateTime;
      const ModificationDate =
        dataFromCPISide.object.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];

      expect(ModificationDate, "Failed on wrong modification date")
        .to.be.a("string")
        .that.is.equal(dateToText);
      expect(CreationDate, "Failed on wrong creation date")
        .to.be.a("string")
        .that.has.lengthOf(24).and.includes("Z").and.includes("T");
    });
  });

  console.log(`SyncDataFromADAL::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}

export async function SyncLargeDataNegative(client: Client, request: Request) {
  console.log(`SyncLargeDataNegative::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const tableName = "syncTable"; //change if you setup a new table
  let size: number = 0;
  const { describe, it, expect, run } = Tester();
  console.log(`SyncLargeDataNegative::Gotten services,initiating requests`);

  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 1,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };

  const settings = await syncService.setSyncOptions(syncOptions);
  const date = new Date();
  await service.sleep(10000);
  //getting file dummy data for large sync (coverted image to base64 that sits on ADAL);
  const getBase64FromADAL = await service.getFromADAL("base64", "base64String");

  const base64 = getBase64FromADAL[0].Base64;

  const objectsArr: {
    Key: string;
    field1: string;
    field2: string;
    field3: string;
    base64: string;
    field4: number;
    Hidden?: boolean;
  }[] = [];

  for (let i = 0; i < 40; i++) {
    //looping around 50 times to get an object above 4MB
    objectsArr.push({
      Key: "key" + Math.floor(Math.random() * 10000000000000),
      field1: "random",
      field2: "data",
      field3: "yey",
      field4: Math.floor(Math.random() * 1000),
      base64: base64,
    });
  }
  //objects array size rough measuring
  for (const object of objectsArr) {
    size += await syncService.roughSizeOfObject(object); // size/2048 = how many MB's are on the data array
  }

  let index = 0;
  for (const object of objectsArr) {
    index++;
    console.log(`now sending the ${index} request`);
    await service.upsertToADAL(tableName, object);
  }

  await service.sleep(5000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });
  await service.sleep(30000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    50
  );
  console.log(auditLog);

  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  console.log(resultObject);

  const purge = await syncService.purgeADALTable(tableName);
  await service.sleep(5000);
  const scheme = await syncService.createADALScheme(tableName, "data");

  console.log(`SyncLargeDataNegative::Finished Logic,starting Mocha tests`);

  describe("Sync Large Data Negative on CPISide automation test", async () => {
    it("Settings Post Test", async () => {
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      expect(
        settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD,
        "Failed on wrong index field returning"
      )
        .to.be.a("string")
        .that.is.equal(syncOptions.USER_DEFINED_COLLECTIONS_INDEX_FIELD);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });

    it("Sync response after inserting data above the soft limit test", async () => {
      expect(resultObject.success, "Failed on success returning wrong value")
        .to.be.a("string")
        .that.is.equal("Exception");
      expect(resultObject.errorCode, "Failed on returning wrong response code")
        .to.be.a("number")
        .that.is.equal(400);
      expect(
        resultObject.resultObject,
        "Failed on result object not returning null"
      ).to.be.null;
      expect(resultObject.errorMessage, "Failed on wrong error message")
        .to.be.a("string")
        .that.is.equal(
          `Failed due to exception: The data size is too big. The maximum data size is ${syncOptions.SYNC_DATA_SIZE_LIMITATION} MB.`
        );
      expect(size / 2048, "failed on object size returning wrong value")
        .to.be.a("number")
        .that.is.above(0)
        .and.below(10000);
    });
  });

  console.log(`SyncLargeDataNegative::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}

export async function DI20990(client: Client, request: Request) {
  console.log(`DI20990::Test Started`);
  const service = new MyService(client);
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  await service.evgeny("http://localhost:8093/16.80.22/webapi", accessToken);
}


export async function SyncLargeDataPositive(client: Client, request: Request) {
  debugger;
  console.log(`SyncLargeDataPositive::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const tableName = "syncTable"; //change if you setup a new table on ADAL
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  let size: number = 0;
  const { describe, it, expect, run } = Tester();
  //resync to cleanse the old data from cpi-side -> till we figure out how it should work
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);
  debugger;

  console.log(`SyncLargeDataPositive::Gotten services,initiating requests`);

  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 5,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: "", // relevant only for UDC tests tableName,
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };

  const settings = await syncService.setSyncOptions(syncOptions);
  console.log(settings);
  const date = new Date();
  await service.sleep(10000);
  //getting file dummy data for large sync (coverts image to base64);
  const getBase64FromADAL = await service.getFromADAL("base64", "base64String");

  const base64 = getBase64FromADAL[0].Base64;

  const objectsArr: {
    Key: string;
    field1: string;
    field2: string;
    field3: string;
    base64: string;
    field4: number;
    Hidden?: boolean;
  }[] = [];

  for (let i = 0; i < 40; i++) {
    //looping around 50 times to get an object above 4MB
    objectsArr.push({
      Key: "key" + Math.floor(Math.random() * 10000000000000),
      field1: "random",
      field2: "data",
      field3: "yey",
      field4: Math.floor(Math.random() * 1000),
      base64: base64,
    });
  }
  //objects array size rough measuring
  for (const object of objectsArr) {
    size += await syncService.roughSizeOfObject(object);
  }
  console.log(size / 2048);
  let index = 0;
  for (const object of objectsArr) {
    index++;
    console.log(`now sending the ${index} request`);
    await service.upsertToADAL(tableName, object);
  }

  await service.sleep(20000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });
  await service.sleep(30000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    50
  );


  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  console.log(resultObject);
  const syncFile = await syncService.getSyncFromAuditLog(
    resultObject.ResourcesURL
  );


  const allData = syncFile.ResourcesData;

  const testData = await syncService.validateResourceData(syncFile.ResourcesData, tableName);

  const testObjectsArrFromAuditLog = [
    testData[0],
    testData[5],
    testData[10],
    testData[20],
    testData[25],
    testData[30],
    testData[39],
  ];
  console.log("data from audit log");


  await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 30);

  await service.sleep(30000);
  const dataFromCPISide = await syncService.getADALListFromCPISide(
    webAPIBaseURL,
    accessToken,
    tableName
  );
  const testObjectsArrFromCPISide = [
    dataFromCPISide.objects[0],
    dataFromCPISide.objects[5],
    dataFromCPISide.objects[10],
    dataFromCPISide.objects[20],
    dataFromCPISide.objects[25],
    dataFromCPISide.objects[30],
    dataFromCPISide.objects[39],
  ];

  const purge = await syncService.purgeADALTable(tableName);
  await service.sleep(5000);
  const scheme = await syncService.createADALScheme(tableName, "data");

  console.log(`SyncLargeDataPositive::Finished Logic,starting Mocha tests`);
  debugger;

  describe("Sync with Get from ADAL Positive on CPISide automation test", async () => {
    it("Settings Post Test", async () => {
      debugger;
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      expect(
        settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD,
        "Failed on wrong index field returning"
      )
        .to.be.a("string")
        .that.is.equal(syncOptions.USER_DEFINED_COLLECTIONS_INDEX_FIELD);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });

    it("Sync pull response from file after inserting data above 4MB test", async () => {
      expect(allData, "Failed on sync returning more than one scheme - DI-20917").to.be.an("array").that.has.lengthOf(1);
      //uncomment once DI-20917 is resolved
      expect(testData, "Failed on array returning wrong value/length")
        .to.be.an("array")
        .that.has.lengthOf(40);
      for (const object of testObjectsArrFromAuditLog) {
        const ModificationDate = object.ModificationDateTime?.split("T")[0];
        const dateToText = date.toISOString().split("T")[0];
        expect(ModificationDate, "Sync modificationDate returned wrong output")
          .to.be.a("string")
          .that.is.equal(dateToText);

        const CreationDate = object.CreationDateTime;
        expect(CreationDate, "Failed on wrong creation date")
          .to.be.a("string")
          .that.has.lengthOf(24).and.includes("Z").and.includes("T");

        expect(object.Key, "Failed on key returning wrong")
          .to.be.a("string")
          .that.includes("key");
        expect(object.field1, "Failed on field1 returning wrong value")
          .to.be.a("string")
          .that.is.equal("random");
        expect(object.field2, "Failed on field2 returning wrong value")
          .to.be.a("string")
          .that.is.equal("data");
        expect(object.field3, "Failed on field3 returning wrong value")
          .to.be.a("string")
          .that.is.equal("yey");
        expect(object.field4, "Failed on field4 returning wrong value")
          .to.be.a("number")
          .that.is.above(0);
        expect(object.base64, "Failed on base64 returning wrong value")
          .to.be.a("string")
          .that.is.equal(base64);
      }
    });

    it("Sync data from CPISide", async () => {
      debugger;
      expect(
        dataFromCPISide.success,
        "Failed on success flag returning wrong value"
      ).to.be.a("boolean").that.is.true;
      expect(
        dataFromCPISide.objects,
        "Failed on array returning wrong length/size/format"
      )
        .to.be.an("array")
        .that.has.lengthOf(40);
      for (const object of testObjectsArrFromCPISide) {
        const ModificationDate = object.ModificationDateTime?.split("T")[0];
        const dateToText = date.toISOString().split("T")[0];
        expect(ModificationDate, "Sync modificationDate returned wrong output")
          .to.be.a("string")
          .that.is.equal(dateToText);

        const CreationDate = object.CreationDateTime;
        expect(CreationDate, "Failed on wrong creation date")
          .to.be.a("string")
          .that.has.lengthOf(24).and.includes("Z").and.includes("T");

        expect(object.Key, "Failed on key returning wrong")
          .to.be.a("string")
          .that.includes("key");
        expect(object.field1, "Failed on field1 returning wrong value")
          .to.be.a("string")
          .that.is.equal("random");
        expect(object.field2, "Failed on field2 returning wrong value")
          .to.be.a("string")
          .that.is.equal("data");
        expect(object.field3, "Failed on field3 returning wrong value")
          .to.be.a("string")
          .that.is.equal("yey");
        expect(object.field4, "Failed on field4 returning wrong value")
          .to.be.a("number")
          .that.is.above(0);
        expect(object.base64, "Failed on base64 returning wrong value")
          .to.be.a("string")
          .that.is.equal(base64);
      }
    });
  });

  console.log(`SyncLargeDataPositive::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}
//will finish after we will be able to lower the sync time limitation to 0.1
export async function syncSoftLimitsNegative(client: Client, request: Request) {
  console.log(`syncSoftLimitsNegative::Test Started`);
  const service = new MyService(client);
  const syncService = new SyncService(client);
  const tableName = "syncTable"; //change if you setup a new table on ADAL - Simcha needs to sync in this table,talk to him
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  let size: number = 0;
  const { describe, it, expect, run } = Tester();
  //resync to cleanse the old data from cpi-side -> till we figure out how it should work
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 50);
  console.log(`syncSoftLimitsNegative::Gotten services,initiating requests`);
  //soft limit time set to 0
  let timeRes1: any;
  const negativeSyncOptions1 = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 15,
    SYNC_TIME_LIMITATION: 0,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  }

  try {
    const settings = await syncService.setSyncOptions(negativeSyncOptions1);
  } catch (e) {
    timeRes1 = (e instanceof Error) ? e?.message : null
  }

  //soft limit time set to 11
  let timeRes2: any;
  const negativeSyncOptions2 = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 15,
    SYNC_TIME_LIMITATION: 11,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  }

  try {
    const settings = await syncService.setSyncOptions(negativeSyncOptions2);
  } catch (e) {
    timeRes2 = (e instanceof Error) ? e?.message : null
  }
  //soft limit size set to above 128
  let sizeRes1: any;
  const negativeSyncOptions3 = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 1025,
    SYNC_TIME_LIMITATION: 5,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  }

  try {
    const settings = await syncService.setSyncOptions(negativeSyncOptions3);
  } catch (e) {
    sizeRes1 = (e instanceof Error) ? e?.message : null
  }
  //sof limit size set to 0
  let sizeRes2: any;
  const negativeSyncOptions4 = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 0,
    SYNC_TIME_LIMITATION: 5,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  }

  try {
    const settings = await syncService.setSyncOptions(negativeSyncOptions3);
  } catch (e) {
    sizeRes2 = (e instanceof Error) ? e?.message : null
  }


  //time soft limit starts here
  const syncOptions = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 15,
    SYNC_TIME_LIMITATION: 0.01,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };

  const settings = await syncService.setSyncOptions(syncOptions);
  const date = new Date();
  await service.sleep(10000);
  //getting file dummy data for large sync (coverted image to base64 that sits on ADAL);
  const getBase64FromADAL = await service.getFromADAL("base64", "base64String");

  const base64 = getBase64FromADAL[0].Base64;

  const objectsArr: {
    Key: string;
    field1: string;
    field2: string;
    field3: string;
    base64: string;
    field4: number;
    Hidden?: boolean;
  }[] = [];

  for (let i = 0; i < 35; i++) {
    //looping around 50 times to get an object above 4MB
    objectsArr.push({
      Key: "key" + Math.floor(Math.random() * 10000000000000),
      field1: "random",
      field2: "data",
      field3: "yey",
      field4: Math.floor(Math.random() * 1000),
      base64: base64,
    });
  }
  //objects array size rough measuring
  for (const object of objectsArr) {
    size += await syncService.roughSizeOfObject(object); // size/2048 = how many MB's are on the data array
  }
  console.log(size);
  let index = 0;
  for (const object of objectsArr) {
    index++;
    console.log(`now sending the ${index} request`);
    await service.upsertToADAL(tableName, object);
  }

  await service.sleep(30000);
  const sync = await syncService.pullData({
    ModificationDateTime: date.toISOString(),
  });
  await service.sleep(45000); //sleep for audit log being written
  const auditLog = await syncService.getAuditLogResultObjectIfValid(
    sync.ExecutionURI,
    60
  );
  console.log(auditLog);

  const resultObject = JSON.parse(auditLog.AuditInfo.ResultObject);
  console.log(resultObject);

  const purge = await syncService.purgeADALTable(tableName);
  await service.sleep(5000);
  const scheme = await syncService.createADALScheme(tableName, "data");

  console.log(`syncSoftLimitsNegative::resetting sync duration to default and resyncing`);

  const syncOptionsToDefault = {
    Key: "SyncVariables",
    SYNC_DATA_SIZE_LIMITATION: 15,
    SYNC_TIME_LIMITATION: 10,
    USER_DEFINED_COLLECTIONS: "",
    USER_DEFINED_COLLECTIONS_INDEX_FIELD: "",
  };

  const settingsSetToDefault = await syncService.setSyncOptions(syncOptionsToDefault);

  await service.sleep(7000);
  await service.initResync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 50);

  console.log(`syncSoftLimitsNegative::Finished Logic,starting Mocha tests`);

  describe("Sync Soft Limits Negative automation test", async () => {
    it("Settings Post Test", async () => {
      expect(
        settings.Hidden,
        "Failed on settings hidden returning wrong output"
      ).to.be.a("boolean").that.is.false;
      expect(settings.Key, "Failed on settings Key returning wrong output")
        .to.be.a("string")
        .that.is.equal(syncOptions.Key);
      expect(
        settings.SYNC_DATA_SIZE_LIMITATION,
        "Sync data size limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_DATA_SIZE_LIMITATION);
      expect(
        settings.SYNC_TIME_LIMITATION,
        "Sync data time limit returned wrong value"
      )
        .to.be.a("number")
        .that.is.equal(syncOptions.SYNC_TIME_LIMITATION);

      expect(
        settings.USER_DEFINED_COLLECTIONS_INDEX_FIELD,
        "Failed on wrong index field returning"
      )
        .to.be.a("string")
        .that.is.equal(syncOptions.USER_DEFINED_COLLECTIONS_INDEX_FIELD);

      const ModificationDate = settings.ModificationDateTime?.split("T")[0];
      const dateToText = date.toISOString().split("T")[0];
      expect(ModificationDate, "Sync modificationdate returned wrong output")
        .to.be.a("string")
        .that.is.equal(dateToText);
    });

    it("Sync response after inserting data above the time soft limit test", async () => {
      expect(resultObject.success, "Failed on success returning wrong value")
        .to.be.a("string")
        .that.is.equal("Exception");
      expect(
        resultObject.resultObject,
        "Failed on result object not returning null"
      ).to.be.null;
      expect(resultObject.errorMessage, "Failed on wrong error message")
        .to.be.a("string")
        .that.is.equal(
          `Failed due to exception: getADALTablesSyncData timed out after 600 ms`
        );
      expect(size / 2048, "failed on object size returning wrong value")
        .to.be.a("number")
        .that.is.above(0)
        .and.below(10000);
    });

    it("Sync settings endpoint negative response test", async () => {
      expect(timeRes1, "Failed on negative time 1 response returning wrong value/format").to.be.a("string").that.includes(`pepperi.com/V1.0/addons/api/5122dc6d-745b-4f46-bb8e-bd25225d350a/api/sync_variables failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: SYNC_TIME_LIMITATION should be in the range (0.01 - 10).","detail":{"errorcode":"BadRequest"}}}`);
      expect(timeRes2, "Failed on negative time 2 response returning wrong value/format").to.be.a("string").that.includes(`pepperi.com/V1.0/addons/api/5122dc6d-745b-4f46-bb8e-bd25225d350a/api/sync_variables failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: SYNC_TIME_LIMITATION should be in the range (0.01 - 10).","detail":{"errorcode":"BadRequest"}}}`);
      expect(sizeRes1, "Failed on negative size 1 response returning wrong value/format").to.be.a("string").that.includes(`pepperi.com/V1.0/addons/api/5122dc6d-745b-4f46-bb8e-bd25225d350a/api/sync_variables failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: SYNC_DATA_SIZE_LIMITATION should be in the range (1 - 1024).","detail":{"errorcode":"BadRequest"}}}`);
      expect(sizeRes2, "Failed on negative size 2 response returning wrong value/format").to.be.a("string").that.includes(`pepperi.com/V1.0/addons/api/5122dc6d-745b-4f46-bb8e-bd25225d350a/api/sync_variables failed with status: 400 - Bad Request error: {"fault":{"faultstring":"Failed due to exception: SYNC_DATA_SIZE_LIMITATION should be in the range (1 - 1024).","detail":{"errorcode":"BadRequest"}}}`);
    });
  });

  console.log(`syncSoftLimitsNegative::Finished Mocha tests`);

  const testResults = await run();
  return testResults;
}
//run this after install if you need to setup a new environment for sync automation
//run locally or it won't find the file
//this inserts to adal to a specific scheme on adal for the big sync tests
export async function insertBase64ToADALAfterInstall(client: Client, request: Request) {
  const service = new MyService(client);

  let srcPath = path.join(__dirname, "../../test-data/scene-Iron-Man.png")
  const file = fs.readFileSync(srcPath);
  const base64 = file.toString("base64");

  const body = {
    Key: "base64String",
    Base64: base64
  }

  const upsert = await service.upsertToADAL("base64", body);
  console.log(upsert);
  return;

}

