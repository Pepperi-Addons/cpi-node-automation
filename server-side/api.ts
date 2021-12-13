import MyService from "./my.service";
import { Client, Request } from "@pepperi-addons/debug-server";
import Tester from "./tester";
import { AddonData } from "@pepperi-addons/papi-sdk";

// add functions here
// this function will run on the 'api/foo' endpoint
// the real function is runnning on another typescript file
export async function foo(client: Client, request: Request) {
  const service = new MyService(client);
  const res = await service.getAddons();
  return res;
}
/** Load function test endpoint */
export async function InitiateLoad(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  const { describe, it, expect, run } = Tester("My test");

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }
  //run in case sync is running before tests
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //set test flag to On
  const flagOn1 = await service.setTestFlag(true, false, 0); // activates test
  await service.sleep(5000);
  const firstSync = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  const flagOn2 = await service.setTestFlag(true, false, 1); // activates second iteration
  await service.sleep(5000);
  const secondSync = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  //set test flag to Off
  const flagOff = await service.setTestFlag(false, false, 0); // deactivates test
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(5000);
  //need to add mocha and UDT get
  const udtData = await service.getUDTValues("LoadUDT", 2, "DESC");
  //need to add test logic
  const removeLines: number[] | undefined = [];
  udtData.forEach(async (obj) => {
    if (obj.InternalID! && typeof obj.InternalID === "number") {
      try {
        removeLines.push(obj.InternalID);
      } catch (err) {
        console.log(`Encountered the following error: ${err}`);
      }
    }
  });

  console.log(udtData);

  describe("Load function automation test", async () => {
    it("Parsed test results", async () => {
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
  // remove UDT lines after test
  removeLines.forEach(async (line) => {
    if (line! && typeof line === "number") {
      await service.removeUDTValues(line);
    }
  });
  const testResults = await run();
  return testResults;
}
/** AddonAPI testing endpoint */
export async function AddonAPITester(client: Client, request: Request) {
  const service = new MyService(client);
  const isLocal = false;
  const { describe, it, expect, run } = Tester("My test");
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);
  if (isLocal) {
    accessToken = "a8d5082f-daa6-4c54-a91d-77b1b2882f5e"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }

  const routerTester = await service.routerTester(webAPIBaseURL, accessToken);

  describe("AddonAPI automation test", async () => {
    it("Parsed test results", async () => {
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
  const atdID = 305697;
  const { describe, it, expect, run } = Tester("My test");
  const isLocal = false;
  await service.setTestFlag(false, true, 0);
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
  await service.setTestFlag(false, false, 0);
  const initSync2 = await service.initSync(accessToken, webAPIBaseURL);
  await service.getSyncStatus(accessToken, webAPIBaseURL, 10);
  await service.sleep(10000);
  const udtData = await service.getUDTValues("InterceptorsUDT", 1, "DESC");
  const removeLines: number[] | undefined = [];
  udtData.forEach(async (obj) => {
    if (obj.InternalID! && typeof obj.InternalID === "number") {
      removeLines.push(obj.InternalID);
    }
  });
  console.log(udtData);
  // some logic to finish the test -- MOCHA
  describe("Load function automation test", async () => {
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
  //remove UDT lines after test
  removeLines.forEach(async (line) => {
    if (line! && typeof line === "number") {
      await service.removeUDTValues(line);
    }
  });

  const testResults = await run();
  return testResults;
}
/** runs CPISide tests */
export async function runCPISideTests(client: Client, request: Request) {
  const service = new MyService(client);
  let testName = request.body.testName;
  const tests = ["UI1", "UI2", "Data", "Negative", "ClientAPI/ADAL"];
  if (!tests.includes(testName)) {
    testName = "error";
  }
  if (testName === "error") {
    const error =
      "Test Name is invalid,please try: UI1/UI2/Data/Negative or ClientAPI/ADAL";
    throw new Error(error);
  }
  const isLocal = false;
  let webAPIBaseURL = await service.getWebAPIBaseURL();
  let accessToken = await service.getAccessToken(webAPIBaseURL);

  if (isLocal) {
    accessToken = "c8cff29a-56f6-4489-a21a-79534785fb85"; //fill in from CPINode debugger
    webAPIBaseURL = "http://localhost:8093";
  }

  const testResults = await service.runCPISideTest(
    accessToken,
    webAPIBaseURL,
    testName
  );

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
/**method to run Performence test */
export async function PerformenceTester(client: Client, request: Request) {
  const service = new MyService(client);
  const { describe, it, expect, run } = Tester("My test");
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
    Name: "Load_Test",
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
  };
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
        .that.is.below(bestDuration * 1.2);

      expect(
        currentRes,
        "Test timespan took longer then the last run + average margin"
      )
        .to.be.a("number")
        .that.is.below(lastRun * 1.1);
    });
  });

  const testResults = await run();
  return testResults;
}
