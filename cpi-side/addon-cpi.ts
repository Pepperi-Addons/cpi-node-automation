import "@pepperi-addons/cpi-node";
import Tester from "./tester";
import { Item, TransactionLine, Transaction, FlowObject } from "@pepperi-addons/cpi-node";
import { NavigationOptions, UDCGetParams, UDCGetListParams } from "./services/general.service";
import DataService, {
  OCEvents,
  addonUUID,
  adalTableName,
} from "./services/data.service";
import { runScript } from "./services/scripts.service";
import { createUIObjectTest } from "./api-tests/create-ui-object";
import { performanceTest } from "./api-tests/performance-test";
import { clientApiADALTest } from "./api-tests/client-api-adal";
import { dataObjectCrud } from "./api-tests/dataobject-crud";
import { dataObjectNegativeCrud } from "./api-tests/dataobject-negative-crud";
import { firstUIObjectCrud } from "./api-tests/ui-object-crud-1";
import { secondUIObjectCrud } from "./api-tests/ui-object-crud-2";
import { Client, EventKey } from "@pepperi-addons/cpi-node/build/cpi-side/events";
import { AddonsDataSearchParams } from "@pepperi-addons/cpi-node/build/cpi-side/client-api";

//**Test data variables */
let ExID: string;
let interceptorArr: number[];
let actionsArr: any[];
let timeoutArr: any[];
let preLoadGetLine: TransactionLine | undefined | number = 1;
let preLoadGetLines: TransactionLine[] | undefined;
let onLoadGetLine: TransactionLine | undefined;
let onLoadGetLines: TransactionLine[] | undefined;
let eventTimingObj = {
  first1: 0,
  first2: 0,
  first3: 0,
  second1: 0,
  second2: 0,
  second3: 0,
  third1: 0,
  third2: 0,
  third3: 0,
  fourth1: 0,
  fourth2: 0,
  fourth3: 0,
  fifth1: 0,
  fifth2: 0,
  fifth3: 0,
  firstClientAction: 0,
  secondClientAction: 0,
};
//how to debug? - https://pepperi-addons.github.io/cpi-node/index.html#debugging
//CPI NODE DOCS https://pepperi-addons.github.io/cpi-node/
/** Load function - setup for interceptors/load tests*/
//The function below sets up interceptors for the automation tests
//https://pepperi-addons.github.io/cpi-node/interfaces/events.interceptor.html
//It is a standard feature on a cpi-node addon
//see load function docs as well
//https://pepperi-addons.github.io/cpi-node/index.html#load
export async function load(configuration: any) {
  console.log("cpi side works!");
  console.log("Setting up test variables");
  const dataService = new DataService();

  ExID = await dataService.getExID();
  interceptorArr = [];
  actionsArr = [];
  timeoutArr = [];
  console.log("Finished setting up test variables");
  // get for test triggers, if one of these return true (happens automatically by the relevant test,triggers on and off when the test starts and ends)
  // See setTestFlag interface and function on server-side/my.service.ts
  // ====================================ADAL================================================
  const adalData = await pepperi.api.adal
    .get({
      addon: addonUUID,
      table: adalTableName,
      key: "testKey1",
    })
    .then((obj) => obj.object);
  //console.log(adalData);
  const loadTestActive = adalData.TestActive;
  const loadTestCounter = adalData.TestRunCounter;
  const InterceptorsTestActive = adalData.InterceptorsTestActive;
  const TrnScopeTestActive = adalData.TrnScopeTestActive;
  const clientActionsTestActive = adalData.clientActionsTestActive;
  const withinHudClientActionsTestActive =
    adalData.clientActionsWithinHudTestActive;
  const InterceptorsTimeoutTestActive = adalData.InterceptorsTimeoutTestActive;
  const InterceptorActionsTest = adalData.InterceptorActionsTest;
  const SyncInteceptorsActive = adalData.SyncInteceptorsActive
  console.log("LoadTester::loadTestActive: " + loadTestActive);
  console.log("LoadTester::counter: " + loadTestCounter);
  console.log(
    "InterceptorTester::InterceptorTestActive: " + InterceptorsTestActive
  );
  console.log("TrnScopeTester::TrnScopeTestActive: " + TrnScopeTestActive);
  console.log(
    "clientActionsTester::clientActionsTestActive: " + clientActionsTestActive
  );
  console.log(
    "clientActionsTester::withinHudClientActionsTestActive: " +
    withinHudClientActionsTestActive
  );
  console.log(
    "clientActionsTester::InterceptorActionsTest: " + InterceptorActionsTest
  );
  console.log(
    "interceptorsTimeoutTester::InterceptorsTimeoutTestActive: " +
    InterceptorsTimeoutTestActive
  );
  console.log(
    "SyncInteceptorsTest::SyncInteceptorsActive: " +
    SyncInteceptorsActive
  );

  //feature flagging -> meaning these load and work in the background only when the relevant flag is available on ADAL (triggerd by test)
  if (InterceptorActionsTest === true) {
    //two exact events with two separate actions
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "firstTrigger" },
      async (data, next, main) => {
        actionsArr.push(1);
        const res = (await data.client?.confirm("confirm", "1")) as boolean;
        if (res === true) {
          actionsArr.push("true");
        }
        actionsArr.push(2);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "firstTrigger" },
      async (data, next, main) => {
        actionsArr.push(3);
        const res = await data.client?.alert("alert", "2");
        if (res === undefined) {
          actionsArr.push("undefind");
        }
        actionsArr.push(4);
      }
    );

    //client actions after main
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "secondTrigger" },
      async (data, next, main) => {
        actionsArr.push(5);
        await next(async () => {
          console.log(
            "InterceptorActionsTest:: SecondTrigger - Inside second main"
          );
          actionsArr.push(7);
        });
        const res = await data.client?.alert("alert", "3");
        if (res === undefined) {
          actionsArr.push("undefind");
        }
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "secondTrigger" },
      async (data, next, main) => {
        actionsArr.push(6);
        console.log(
          "InterceptorActionsTest:: SecondTrigger - Inside first main"
        );
      }
    );

    //client action within main
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "thirdTrigger" },
      async (data, next, main) => {
        actionsArr.push(8);
        await next(async (data) => {
          const res = (await data.client?.confirm("confirm", "4")) as boolean;
          if (res === true) {
            actionsArr.push("true");
          }
          actionsArr.push(10);
        });
        console.log(
          "InterceptorActionsTest:: ThirdTrigger - Inside second main"
        );
        actionsArr.push(11);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "thirdTrigger" },
      async (data, next, main) => {
        actionsArr.push(9);
        console.log(
          "InterceptorActionsTest:: ThirdTrigger - Inside first main"
        );
      }
    );

    //client action before main
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fourthTrigger" },
      async (data, next, main) => {
        const res = await data.client?.confirm("confirm", "5");
        if (res === true) {
          actionsArr.push("true");
        }
        actionsArr.push(12);
        await next(async () => {
          actionsArr.push(14);
          console.log(
            "InterceptorActionsTest:: FourthTrigger - Inside second main"
          );
        });
        actionsArr.push(15);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fourthTrigger" },
      async (data, next, main) => {
        actionsArr.push(13);
        console.log(
          "InterceptorActionsTest:: FourthTrigger - Inside first main"
        );
      }
    );

    //expired client actions
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fifthTrigger" },
      async (data, next, main) => {
        setTimeout(async () => {
          const res = (await data.client?.confirm("confirm", "-1")) as boolean;
          if (res === true) {
            actionsArr.push("true");
          }
        }, 100);
        console.log(
          "InterceptorActionsTest:: FifthTrigger - Inside first main"
        );
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fifthTrigger" },
      async (data, next, main) => {
        await new Promise((resolve) => setTimeout(resolve, 110));
        const res = await data.client?.alert("alert", "6");
        if (res === undefined) {
          actionsArr.push("undefind");
        }
        actionsArr.push(16);
        console.log(
          "InterceptorActionsTest:: FifthTrigger - Inside second main"
        );
      }
    );

    //wait for last client action
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "sixthTrigger" },
      async (data, next, main) => {
        debugger;
        console.log(
          "InterceptorActionsTest:: sixthTrigger - Inside first main"
        );
        const res = await data.client?.captureGeoLocation({
          accuracy: "Medium",
          maxWaitTime: 400,
        });
        actionsArr.push(JSON.stringify(res));
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "sixthTrigger" },
      async (data, next, main) => {
        debugger;
        console.log(
          "InterceptorActionsTest:: sixthTrigger - Inside second main"
        );
        data.client
          ?.captureGeoLocation({ accuracy: "High", maxWaitTime: 1000 })
          .then((res) => {
            console.log("InterceptorActionsTest:: sixthTrigger - Inside then");
            debugger;
            actionsArr.push(JSON.stringify(res));
          });
        try {
          debugger;
          const upsert = await pepperi.api.userDefinedTables.upsert({
            table: "actionsSequence",
            mainKey: new Date().toISOString(),
            secondaryKey: "TestResults",
            value: actionsArr.toString(),
          });
          console.log(upsert);
        } catch (err) {
          console.log(err);
        }
      }
    );
  }
  if (withinHudClientActionsTestActive === true) {
    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAAlertWithinHud" },
      async (data, next, main) => {
        console.log(
          "withinHudClientActionsTester::button pressed! starting Dialog client actions interceptor"
        );
        let options = {
          message: "withinHudTest",
          closeMessage: "HUD!!!",
          delay: 0.2,
          block: async (message) => {
            await data.client?.alert("alertWithinHud", "<p>Slava Ukraine<p>");
            const confirm = await data.client?.confirm(
              "confirmWithinHud",
              "putin is a huylo yayaya"
            );
            const showDialog = await data.client?.showDialog({
              title: "showDialogWithinHud",
              content: "putin pashul nahuy dibilnaya tvar yaya",
              actions: [
                { title: "not cool putin yaya", value: 1 },
                { title: "really not cool putin yaya", value: 2 },
                { title: "putin is a boomeryaya", value: 3 },
              ],
            });
            for (let i = 0; i < 10; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              message(`withinHudTest`);
            }
          },
        };
        const hud = await data.client?.showHUD(options);

        console.log(hud);
        console.log(
          "withinHudClientActionsTester::button pressed! finished Dialog client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSABarcodeWithinHud" },
      async (data, next, main) => {
        console.log(
          "withinHudClientActionsTester::button pressed! starting barcodeWithinHud client actions interceptor"
        );
        let options = {
          message: "withinHudTest",
          closeMessage: "HUD!!!",
          delay: 2,
          block: async (message) => {
            await data.client?.scanBarcode();
            for (let i = 0; i < 20; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              message(`withinHudTest`);
            }
          },
        };
        const hud = await data.client?.showHUD(options);

        console.log(hud);
        console.log(
          "withinHudClientActionsTester::button pressed! finished barcodeWithinHud client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAGeoLocationWithinHud" },
      async (data, next, main) => {
        console.log(
          "withinHudClientActionsTester::button pressed! starting TSAGeoLocationWithinHud client actions interceptor"
        );
        let options = {
          message: "withinHudTest",
          closeMessage: "HUD!!!",
          delay: 0.2,
          block: async (message) => {
            await data.client?.captureGeoLocation({
              accuracy: "High",
              maxWaitTime: 3000,
            });
            await data.client?.captureGeoLocation({
              accuracy: "Medium",
              maxWaitTime: 2000,
            });
            await data.client?.captureGeoLocation({
              accuracy: "Low",
              maxWaitTime: 1500,
            });
            for (let i = 0; i < 9; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              message(`withinHudTest`);
            }
          },
        };
        const hud = await data.client?.showHUD(options);

        console.log(hud);
        console.log(
          "withinHudClientActionsTester::button pressed! finished TSAGeoLocationWithinHud client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAWithinMixedHudFirst" },
      async (data, next, main) => {
        console.log(
          "withinHudClientActionsTester::button pressed! starting WithinMixedHudFirst client actions interceptor"
        );
        let options = {
          message: "withinHudTest",
          closeMessage: "HUD!!!",
          delay: 0.75,
          block: async (message) => {
            await data.client?.captureGeoLocation({
              accuracy: "High",
              maxWaitTime: 3000,
            });
            await data.client?.scanBarcode();
            await data.client?.confirm(
              "confirmWithinHud",
              "putin is a huylo yayaya"
            );
            await data.client?.captureGeoLocation({
              accuracy: "Medium",
              maxWaitTime: 2000,
            });
            await data.client?.alert("alertWithinHud", "<p>Slava Ukraine<p>");
            await data.client?.captureGeoLocation({
              accuracy: "Low",
              maxWaitTime: 1500,
            });
            await data.client?.showDialog({
              title: "showDialogWithinHud",
              content: "putin pashul nahuy dibilnaya tvar yaya",
              actions: [
                { title: "not cool putin yaya", value: 1 },
                { title: "really not cool putin yaya", value: 2 },
                { title: "putin is a boomeryaya", value: 3 },
              ],
            });

            for (let i = 0; i < 8; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              message(`withinHudTest`);
            }
          },
        };
        const hud = await data.client?.showHUD(options);

        console.log(hud);
        console.log(
          "withinHudClientActionsTester::button pressed! finished WithinMixedHudFirst client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAWithinMixedHudSecond" },
      async (data, next, main) => {
        console.log(
          "withinHudClientActionsTester::button pressed! starting WithinMixedHudSecond client actions interceptor"
        );
        let options = {
          message: "withinHudTest",
          closeMessage: "HUD!!!",
          delay: 0.25,
          block: async (message) => {
            await data.client?.scanBarcode();
            await data.client?.captureGeoLocation({
              accuracy: "Low",
              maxWaitTime: 1500,
            });
            await data.client?.scanBarcode();
            await data.client?.confirm(
              "confirmWithinHud",
              "putin is a huylo yayaya"
            );
            await data.client?.captureGeoLocation({
              accuracy: "High",
              maxWaitTime: 3000,
            });
            await data.client?.alert("alertWithinHud", "<p>Slava Ukraine<p>");
            await data.client?.scanBarcode();
            await data.client?.captureGeoLocation({
              accuracy: "Medium",
              maxWaitTime: 2000,
            });
            await data.client?.showDialog({
              title: "showDialogWithinHud",
              content: "putin pashul nahuy dibilnaya tvar yaya",
              actions: [
                { title: "not cool putin yaya", value: 1 },
                { title: "really not cool putin yaya", value: 2 },
                { title: "putin is a boomeryaya", value: 3 },
              ],
            });
            await data.client?.scanBarcode();

            for (let i = 0; i < 12; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              message(`withinHudTest`);
            }
          },
        };
        const hud = await data.client?.showHUD(options);

        console.log(hud);
        console.log(
          "withinHudClientActionsTester::button pressed! finished WithinMixedHudSecond client actions interceptor"
        );
        await next(main);
      }
    );
  }
  //=========================client-actions implementation=======================
  if (clientActionsTestActive === true) {
    //alert interceptor
    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAAlert" },
      async (data, next, main) => {
        console.log(
          "clientActionsTester::button pressed! starting Dialog client actions interceptor"
        );
        const alert = await data.client?.alert("alert", "putin is douchebag");
        const confirm = await data.client?.confirm(
          "confirm",
          "putin is a huylo"
        );
        const showDialog = await data.client?.showDialog({
          title: "showDialog",
          content: "putin pashul nahuy dibilnaya tvar",
          actions: [
            { title: "not cool putin", value: 1 },
            { title: "really not cool putin", value: 2 },
            { title: "putin is a boomer", value: 3 },
          ],
        });

        console.log(alert);
        console.log(confirm);
        console.log(showDialog);
        console.log(
          "clientActionsTester::button pressed! finished Dialog client actions interceptor"
        );
        await next(main);
      }
    );
    //hud interceptor
    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAHUD" },
      async (data, next, main) => {
        console.log("button pressed! on hud");
        const hudOptions = {
          // HUD's message
          message: "Waiting....", // optional (default value is '')

          // adds a button with text to the HUD
          closeMessage: "Press to close", // optional - (default is '' and the botton is hidden)
          //need to change closeMessage to the real attribute
          //display the HUD after the delay time (the block runs in the meantime)
          delay: 0.2, //optional - (default value is 0.5)

          // block of code that will run in background while the HUD is showing.
          block: async () => {
            // do stuff that takes a long time that needs a HUD
            // for example:
            // You can call any client action you want like this.
            for (let i = 0; i < 15; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              // you can update the HUD message while the HUD is showing
              //updateMessage(`In progress ${i}%`);
            }
          },
        };

        const hud = await data.client?.showHUD(hudOptions);
        console.log(hud);
        await next(main);
      }
    );
    //scanBarcode interceptor
    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSAScanBarcode" },
      async (data, next, main) => {
        console.log("button pressed! on captureGeo");
        const barcode = await data.client?.scanBarcode();
        console.log(barcode);
        await next(main);
      }
    );
    //captureGeo interceptor
    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSACaptureGeo" },
      async (data, next, main) => {
        console.log(
          "clientActionsTester::button pressed! starting captureGeo client actions interceptor"
        );
        const captureHigh = await data.client?.captureGeoLocation({
          accuracy: "High",
          maxWaitTime: 300,
        });
        const captureMed = await data.client?.captureGeoLocation({
          accuracy: "Medium",
          maxWaitTime: 200,
        });
        const captureLow = await data.client?.captureGeoLocation({
          accuracy: "Low",
          maxWaitTime: 400,
        });

        console.log(captureHigh);
        console.log(captureMed);
        console.log(captureLow);
        console.log(
          "clientActionsTester::button pressed! finished captureGeo client actions interceptor"
        );
        await next(main);
      }
    );
    //navigate interceptors
    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSANavigateToCustomPage" },
      async (data, next, main) => {
        console.log(
          "clientActionsTester::button pressed! starting TSANavigateToCustomPage client actions interceptor"
        );
        const options: NavigationOptions = {
          url: "/customblankpage",
          history: "ClearTo",
        };

        await data.client?.navigateTo(options);

        console.log(
          "clientActionsTester::button pressed! finished TSANavigateToCustomPage client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSANavigateToHome" },
      async (data, next, main) => {
        console.log(
          "clientActionsTester::button pressed! starting TSANavigateToHome client actions interceptor"
        );
        const options: NavigationOptions = {
          url: "/homepage",
          history: "None",
        };

        await data.client?.navigateTo(options);

        console.log(
          "clientActionsTester::button pressed! finished TSANavigateToHome client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSANavigateToCustomModal" },
      async (data, next, main) => {
        console.log(
          "clientActionsTester::button pressed! starting TSANavigateToCustomModal client actions interceptor"
        );

        const alert = await data.client?.alert("alert", "putin is douchebag");

        const options: NavigationOptions = {
          url: "/customblankpage",
          history: "None",
        };

        await data.client?.navigateTo(options);

        console.log(
          "clientActionsTester::button pressed! finished TSANavigateToCustomModal client actions interceptor"
        );
        await next(main);
      }
    );

    pepperi.events.intercept(
      OCEvents.Button,
      { FieldID: "TSANavigateBack" },
      async (data, next, main) => {
        console.log(
          "clientActionsTester::button pressed! starting TSANavigateBack client actions interceptor"
        );

        await data.client?.navigateBack();

        await data.client?.alert("sould not fire", "if it does its a bug");

        console.log(
          "clientActionsTester::button pressed! finished TSANavigateBack client actions interceptor"
        );
        await next(main);
      }
    );
  }

  if (TrnScopeTestActive === true) {
    //========================TransactionScope Interceptors===================================
    pepperi.events.intercept(OCEvents.preLoad, {}, async (data, next, main) => {
      console.log("preLoadTransactionScope interceptor");
      // let itemRes = await pepperi.api.items.get({
      //   key: { UUID: "E9AAF730-90FC-43D0-945A-A81537908F8C" }, //AQ3
      //   fields: ["InternalID", "ExternalID", "UUID"],
      // });

      let itemRes = await pepperi.api.items.search({
        fields: ["UUID", "ExternalID", "InternalID"],
        filter: {
          ApiName: "ExternalID",
          FieldType: "String",
          Operation: "IsEqual",
          Values: ["AQ3"],
        },
      });

      let itemUUID = itemRes.objects[0].UUID;

      let itemDataObject: Item | undefined = await pepperi.DataObject.Get(
        "items",
        itemUUID
      );
      const Transaction = data.DataObject as Transaction;
      //saving data in global variable (saves only when test runs)
      preLoadGetLine = await Transaction.transactionScope?.getLine(
        itemDataObject as Item
      ); // should get undefined
      preLoadGetLines = await Transaction.transactionScope?.getLines(); // should return empty array
      interceptorArr.push(0); //checking order of interceptors
    });

    pepperi.events.intercept(OCEvents.onLoad, {}, async (data, next, main) => {
      console.log("OnLoadTransactionScope interceptor");
      // let itemRes = await pepperi.api.items.get({
      //   key: { UUID: "E9AAF730-90FC-43D0-945A-A81537908F8C" }, //AQ3
      //   fields: ["InternalID", "ExternalID", "UUID"],
      // });

      let itemRes = await pepperi.api.items.search({
        fields: ["UUID", "ExternalID", "InternalID"],
        filter: {
          ApiName: "ExternalID",
          FieldType: "String",
          Operation: "IsEqual",
          Values: ["AQ3"],
        },
      });

      let itemUUID = itemRes.objects[0].UUID;

      let itemDataObject: Item | undefined = await pepperi.DataObject.Get(
        "items",
        itemUUID
      );
      const Transaction = data.DataObject as Transaction;
      //saving data in global variable (saves only when test runs)
      onLoadGetLine = await Transaction.transactionScope?.getLine(
        itemDataObject as Item
      ); // should return item normally -> accepts itemDataObject
      onLoadGetLines = await Transaction.transactionScope?.getLines(); // should return all catalog items
      interceptorArr.push(1); //checking order of interceptors
    });
  }

  //==========================Load inserts into UDT/ADAL====================================
  //Load test essentially performs a sync while this is active,after the sync the Load function should run again (that's the scenario)
  //PLEASE DEBUG THE TESTS THAT THE INTERCEPTORS BELOW ARE RELATED TO ON THE SERVER SIDE,NO REAL WAY TO DEBUG THESE IN A LIVE CODE SESSION FROM CPI-SIDE
  if (
    loadTestActive === true &&
    (loadTestCounter === 0 || loadTestCounter === 1)
  ) {
    console.log("LoadTester::Inside load test if");
    //insert one line into UDT after the each load occured
    const date = new Date();
    console.log(
      "LoadTester::write to UDT by the " +
      loadTestCounter +
      " Index, TimeStamp: " +
      date.toISOString()
    );
    try {
      await pepperi.api.userDefinedTables.upsert({
        table: "LoadUDT",
        mainKey: date.toISOString(),
        secondaryKey: loadTestCounter.toString(),
        value: date.toISOString(),
      });
    } catch (err) {
      console.log("LoadTester::issue detected on UDT insert.");
      console.log(err);
    }
  }
  //Interceptors test
  if (InterceptorsTestActive === true) {
    //=======================Interceptors test setup======================================
    //==================================Recalculate interceptors==========================
    pepperi.events.intercept(
      OCEvents.Recalculate,
      { UIObject: { context: { Name: "AccountForm" } } },
      async (data, next, main) => {
        console.log("InterceptorsTester::Recalculate 1 - before main");
        interceptorArr.push(22);
        await next(main);
        main = async (data) => {
          console.log("InterceptorsTester::Recalculate 1 - inside main");
          interceptorArr.push(42);
        };
        console.log("InterceptorsTester::Recalculate 1 - after main");
        interceptorArr.push(31);
        console.log(interceptorArr);
        try {
          const upsert = await pepperi.api.userDefinedTables.upsert({
            table: "InterceptorsUDT",
            mainKey: new Date().toISOString(),
            secondaryKey: "TestResults",
            value: interceptorArr.toString(),
          });
          console.log(upsert);
        } catch (err) {
          console.log(err);
        }
      }
    );
    pepperi.events.intercept(
      OCEvents.Recalculate,
      { UIObject: { context: { Name: "AccountForm" } } },
      async (data, next, main) => {
        console.log("InterceptorsTester::Recalculate 2 - before main");
        interceptorArr.push(23);
        await next(main);
        await next(async (data) => {
          console.log("InterceptorsTester::Recalculate 2 - inside main");
          interceptorArr.push(43);
        });
        console.log("InterceptorsTester::Recalculate 2 - after main");
        interceptorArr.push(30);
      }
    );
    pepperi.events.intercept(
      OCEvents.Recalculate,
      { UIObject: { Context: { name: "AccountForm" } } },
      async (data, next, main) => {
        console.log("InterceptorsTester::Recalculate 3 - before main");
        if (interceptorArr[interceptorArr.length - 1] === 23) {
          interceptorArr.push(24);
        } else {
          interceptorArr.push(27);
        }
        await next(async (data) => {
          console.log("InterceptorsTester::Recalculate 3 - inside main");
          if (interceptorArr[interceptorArr.length - 1] === 24) {
            interceptorArr.push(25);
          } else {
            interceptorArr.push(28);
          }
        });
        console.log("InterceptorsTester::Recalculate 3 - after main");
        if (interceptorArr[interceptorArr.length - 1] === 25) {
          interceptorArr.push(26);
        } else {
          interceptorArr.push(29);
        }
      }
    );
    //Lines
    //====================IncrementFieldValue - BELOW LOGIC FOR IncrementFieldValue IS READY========================
    pepperi.events.intercept(
      OCEvents.Increment,
      { FieldID: "UnitsQuantity" },
      async (data, next, main) => {
        console.log("InterceptorsTester::IncrementFieldValue 1 - before main");
        interceptorArr.push(8);
        main = async () => {
          console.log("InterceptorsTester::IncrementFieldValue 1 - main");
          interceptorArr.push(11);
        };
        await next(main);
        console.log("InterceptorsTester::IncrementFieldValue 1 - after main");
        interceptorArr.push(14);
        console.log(interceptorArr);
      }
    );
    pepperi.events.intercept(
      OCEvents.Increment,
      { FieldID: "UnitsQuantity" },
      async (data, next, main) => {
        console.log("InterceptorsTester::IncrementFieldValue 2 - before main");
        interceptorArr.push(9);
        await next(main);
        main = async () => {
          console.log("InterceptorsTester::IncrementFieldValue 2 - main");
          interceptorArr.push(10);
        };
        console.log("InterceptorsTester::IncrementFieldValue 2 - after main");
        interceptorArr.push(13);
      }
    );
    pepperi.events.intercept(
      OCEvents.Increment,
      { fieldID: "UnitsQuantity" },
      async (data, next, main) => {
        console.log("InterceptorsTester::IncrementFieldValue 3 - before main");
        interceptorArr.push(10);
        await next(main);
        console.log("InterceptorsTester::IncrementFieldValue 3 - after main");
        interceptorArr.push(12);
      }
    );
    //=====================DecrementFieldValue events==================================
    pepperi.events.intercept(
      OCEvents.Decrement,
      { FieldID: "UnitsQuantity" },
      async (data, next, main) => {
        console.log("InterceptorsTester::DecrementFieldValue 1 - before main");
        interceptorArr.push(15);
        await next(main);
        console.log("InterceptorsTester::DecrementFieldValue 1 - after main");
        interceptorArr.push(21);
        console.log(interceptorArr);
      }
    );
    pepperi.events.intercept(
      OCEvents.Decrement,
      { FieldID: "UnitsQuantity" },
      async (data, next, main) => {
        console.log("InterceptorsTester::DecrementFieldValue 2 - before main");
        interceptorArr.push(16);
        await next(async (data) => {
          console.log("InterceptorsTester::DecrementFieldValue 2 - main");
          interceptorArr.push(19);
        });
        console.log("InterceptorsTester::DecrementFieldValue 2 - after main");
        interceptorArr.push(20);
      }
    );
    pepperi.events.intercept(
      OCEvents.Decrement,
      { fieldID: "UnitsQuantity" },
      async (data, next, main) => {
        console.log("InterceptorsTester::DecrementFieldValue 3 - before main");
        interceptorArr.push(17);
        main = async () => {
          console.log("InterceptorsTester::DecrementFieldValue 3 - main");
          interceptorArr.push(77);
        };
        console.log("InterceptorsTester::DecrementFieldValue 3 - after main");
        interceptorArr.push(18);
      }
    );
    //header -- BELOW LOGIC FOR SETFIELDVALUE IS READY
    pepperi.events.intercept(
      OCEvents.SetField,
      { FieldID: "TSAInterceptorTrigger" },
      async (data, next, main) => {
        console.log("InterceptorsTester::SetFieldValue 1 - before main");
        interceptorArr.push(1);
        await next(main);
        main = async () => {
          console.log("InterceptorsTester::SetFieldValue 1 - inside main");
          interceptorArr.push(42);
        };
        console.log("InterceptorsTester::SetFieldValue 1 - after main");
        interceptorArr.push(7);
        console.log(interceptorArr);
      }
    );
    pepperi.events.intercept(
      OCEvents.SetField,
      { FieldID: "TSAInterceptorTrigger" },
      async (data, next, main) => {
        console.log("InterceptorsTester::SetFieldValue 2 - before main");
        interceptorArr.push(2);
        await next(main);
        console.log("InterceptorsTester::SetFieldValue 2 - after main");
        interceptorArr.push(6);
      }
    );
    pepperi.events.intercept(
      OCEvents.SetField,
      { fieldID: "TSAInterceptorTrigger" },
      async (data, next, main) => {
        console.log("InterceptorsTester::SetFieldValue 3 - before main");
        interceptorArr.push(3);
        await next(async () => {
          console.log("InterceptorsTester::SetFieldValue 3 - inside main");
          interceptorArr.push(4);
        });
        console.log("InterceptorsTester::SetFieldValue 3 - after main");
        interceptorArr.push(5);
      }
    );
  }
  //InterceptorsTimeoutTest
  if (InterceptorsTimeoutTestActive === true) {
    //3 interceptors with next&main - timeout before main - should provide output of 1,5,8,9,10,7
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "firstTimeout" },
      async (data, next) => {
        eventTimingObj.first1 = performance.now();
        timeoutArr.push(1);
        await new Promise((resolve) => {
          console.log("never resolve");
        });
        timeoutArr.push(2);
        await next(async () => {
          timeoutArr.push(3);
        });
        timeoutArr.push(4);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "firstTimeout" },
      async (data, next) => {
        eventTimingObj.first2 = performance.now();
        eventTimingObj.first1 = performance.now() - eventTimingObj.first1;
        timeoutArr.push(5);
        await next(async () => {
          timeoutArr.push(6);
        });
        timeoutArr.push(7);
        //eventTimingObj.first = performance.now() - eventTimingObj.first;
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "firstTimeout" },
      async (data, next) => {
        eventTimingObj.first3 = performance.now();
        eventTimingObj.first2 = performance.now() - eventTimingObj.first2;
        timeoutArr.push(8);
        await next(async () => {
          timeoutArr.push(9);
        });
        timeoutArr.push(10);
        eventTimingObj.first3 = performance.now() - eventTimingObj.first3;
      }
    );

    //3 interceptors with next & main - timeout after main - should output 11,13,16,17,18,15
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "secondTimeout" },
      async (data, next) => {
        eventTimingObj.second1 = performance.now();
        timeoutArr.push(11);
        await next(async () => {
          timeoutArr.push(12);
        });
        timeoutArr.push(15);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "secondTimeout" },
      async (data, next) => {
        eventTimingObj.second1 = performance.now() - eventTimingObj.second1;
        eventTimingObj.second2 = performance.now();
        timeoutArr.push(13);
        await next(async () => {
          timeoutArr.push(14);
        });
        await new Promise((resolve) => {
          console.log("never resolve");
        });
        timeoutArr.push(-1);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "secondTimeout" },
      async (data, next) => {
        eventTimingObj.second2 = performance.now() - eventTimingObj.second2;
        eventTimingObj.second3 = performance.now();
        timeoutArr.push(16);
        await next(async () => {
          timeoutArr.push(17);
        });
        timeoutArr.push(18);
        eventTimingObj.second3 = performance.now() - eventTimingObj.second3;
      }
    );

    //3 interceptors with next & main - timeout within main - should output 19,22,25,26,27,24,21
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "thirdTimeout" },
      async (data, next) => {
        eventTimingObj.third1 = performance.now();
        timeoutArr.push(19);
        await next(async () => {
          timeoutArr.push(20);
        });
        timeoutArr.push(21);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "thirdTimeout" },
      async (data, next) => {
        eventTimingObj.third2 = performance.now();
        eventTimingObj.third1 = performance.now() - eventTimingObj.third1;
        timeoutArr.push(22);
        await next(async () => {
          await new Promise((resolve) => {
            console.log("never resolve");
          });
          timeoutArr.push(23);
        });
        timeoutArr.push(24);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "thirdTimeout" },
      async (data, next) => {
        eventTimingObj.third2 = performance.now() - eventTimingObj.third2;
        eventTimingObj.third3 = performance.now();
        timeoutArr.push(25);
        await next(async () => {
          timeoutArr.push(26);
        });
        timeoutArr.push(27);
        eventTimingObj.third3 = performance.now() - eventTimingObj.third3;
      }
    );

    //3 interceptors with next & main - timeout before and after main - should output 28,32,35,36,37
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fourthTimeout" },
      async (data, next) => {
        eventTimingObj.fourth1 = performance.now();
        timeoutArr.push(28);
        await new Promise((resolve) => {
          console.log("never resolve");
        });
        timeoutArr.push(29);
        await next(async () => {
          timeoutArr.push(30);
        });
        timeoutArr.push(31);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fourthTimeout" },
      async (data, next) => {
        eventTimingObj.fourth1 = performance.now() - eventTimingObj.fourth1;
        eventTimingObj.fourth2 = performance.now();
        timeoutArr.push(32);
        await next(async () => {
          timeoutArr.push(33);
        });
        await new Promise((resolve) => {
          console.log("never resolve");
        });
        timeoutArr.push(34);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fourthTimeout" },
      async (data, next) => {
        eventTimingObj.fourth2 = performance.now() - eventTimingObj.fourth2;
        eventTimingObj.fourth3 = performance.now();
        timeoutArr.push(35);
        await next(async () => {
          timeoutArr.push(36);
        });
        timeoutArr.push(37);
        eventTimingObj.fourth3 = performance.now() - eventTimingObj.fourth3;
      }
    );

    //3 interceptors with next & main - timeout exclude client actions time - should output 38,39,42,43,46,47,48
    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fifthTimeout" },
      async (data, next) => {
        eventTimingObj.fifth1 = performance.now();
        timeoutArr.push(38);
        eventTimingObj.firstClientAction = performance.now();
        const res = await data.client?.captureGeoLocation({
          maxWaitTime: 200,
          accuracy: "Medium",
        });
        eventTimingObj.firstClientAction = performance.now() - eventTimingObj.firstClientAction;
        timeoutArr.push(39);
        await next(async () => {
          timeoutArr.push(40);
        });
        timeoutArr.push(41);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fifthTimeout" },
      async (data, next) => {
        eventTimingObj.fifth1 = performance.now() - eventTimingObj.fifth1 - eventTimingObj.firstClientAction;
        eventTimingObj.fifth2 = performance.now();
        timeoutArr.push(42);
        eventTimingObj.secondClientAction = performance.now();
        const res = await data.client?.captureGeoLocation({
          maxWaitTime: 200,
          accuracy: "Medium",
        });
        eventTimingObj.secondClientAction = performance.now() - eventTimingObj.secondClientAction;
        timeoutArr.push(43);
        await next(async () => {
          timeoutArr.push(44);
        });
        timeoutArr.push(45);
      }
    );

    pepperi.events.intercept(
      "TSAButtonPressed",
      { FieldID: "fifthTimeout" },
      async (data, next) => {
        eventTimingObj.fifth2 = performance.now() - eventTimingObj.fifth2 - eventTimingObj.secondClientAction;
        eventTimingObj.fifth3 = performance.now();
        timeoutArr.push(46);
        await next(async () => {
          timeoutArr.push(47);
        });
        timeoutArr.push(48);
        eventTimingObj.fifth3 = performance.now() - eventTimingObj.fifth3;
        try {
          const upsert = await pepperi.api.userDefinedTables.upsert({
            table: "interceptorsTimeout",
            mainKey: new Date().toISOString(),
            secondaryKey: "TestResults",
            value: timeoutArr.toString(),
          });
          console.log(upsert);
        } catch (err) {
          console.log(err);
        }

        try {
          const upsert = await pepperi.api.userDefinedTables.upsert({
            table: "interceptorsTiming",
            mainKey: new Date().toISOString(),
            secondaryKey: "TestResults",
            value: JSON.stringify(eventTimingObj),
          });
          console.log(upsert);
        } catch (err) {
          console.log(err);
        }
      }
    );
  }
  if (SyncInteceptorsActive === true) {
    pepperi.events.intercept("SyncStarted", {}, async (data, next, main) => {

      const date = new Date();
      console.log(
        "SyncEventsTester:: Sync Started write to UDT by the TimeStamp: " +
        date.toISOString()
      );
      try {
        await pepperi.api.userDefinedTables.upsert({
          table: "SyncInterceptors",
          mainKey: `SyncStarted${date.toISOString()}`,
          secondaryKey: "SyncStarted",
          value: date.toISOString(),
        });
      } catch (err) {
        console.log("SyncEventsTester::issue detected on UDT insert.");
        console.log(err);
      }


    });

    pepperi.events.intercept("SyncTerminated", {}, async (data, next, main) => {
      const parsedData = JSON.stringify(data);
      const date = new Date();
      console.log(
        "SyncEventsTester:: Sync terminated : write to UDT by the TimeStamp: " +
        date.toISOString()
      );
      try {
        await pepperi.api.userDefinedTables.upsert({
          table: "SyncInterceptors",
          mainKey: `SyncStopped${date.toISOString()}`,
          secondaryKey: "SyncStopped",
          value: parsedData,
        });
      } catch (err) {
        console.log("SyncEventsTester::issue detected on UDT insert.");
        console.log(err);
      }

    });
  }
}

export const router = Router();
//debugger for specific code chunks,use this if you need a dummy endpoint on cpi-side
router.use("/debug-tester", async (req, res) => {
  console.log("Start");
  console.log("end");
});
//setup routers for AddonAPI automation tests
//docs https://pepperi-addons.github.io/cpi-node/index.html#addon-api
router.get("/addon-api/get", (req, res) => {
  console.log("AddonAPI test currently on CPISide - GET with query params");
  const queryString = req.query.q;
  if (
    queryString === "queryParam" &&
    queryString !== null &&
    queryString !== undefined
  ) {
    res.json({
      result: "success",
      params: queryString,
    });
  }
  res.json({ result: "failure" });
});
router.post("/addon-api/post", async (req, res) => {
  console.log("AddonAPI test currently on CPISide - POST with body params");
  const bodyParams = req.body.a;
  if (
    bodyParams === "bodyParam" &&
    bodyParams !== null &&
    bodyParams !== undefined
  ) {
    res.json({
      result: "success",
      params: bodyParams,
    });
  }
  res.json({ result: "failure" });
});
router.use("/addon-api/:v/use", async (req, res, next) => {
  console.log("AddonAPI test currently on CPISide - USE with params");
  const params = req.params.v;
  try {
    if (params === "param" && params !== null && params !== undefined) {
      res.json({
        result: "success",
        params: params,
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ result: "failure", error: err });
  }
});
//Recalculate trigger for interceptors test - triggers a recalculate event in which there is an awaiting interceptor
router.get("/recalculate/:UUID/trigger", async (req, res, next) => {
  const accountUUID = req.params.UUID;
  if (accountUUID === null || accountUUID === undefined || accountUUID === "") {
    res.json({
      result: "failure - no UUID was passed",
    });
  }
  let accDataObject = await pepperi.DataObject.Get("accounts", accountUUID);
  let accDetailsUIPage;
  if (accDataObject!) {
    try {
      accDetailsUIPage = await pepperi.UIPage.Create("Details", accDataObject!);
      await accDetailsUIPage.rebuild();
    } catch (err) {
      console.log(err);
      res.json({
        result: "failure - failed on creating UIObject",
      });
    }
  }
  res.json({
    result: "success",
  });
});
//==============================/ClientAPI/ADAL test Endpoint=======================================
router.get("/ClientAPI/ADAL", async (req, res, next) => {
  console.log("Inside clientAPI/ADAL test endpoint");
  const testResult = await clientApiADALTest();
  res.json(testResult);
});
//===========================Performence/Stress tests Endpoint================================
router.get("/PerformenceTest", async (req, res, next) => {
  console.log("Inside performaceTest Endpoint");
  const perfResults = await performanceTest();
  res.json({
    currentResults: perfResults,
  });
});
//EVGENY
router.get("/DI-20990", async (req, res, next) => {
  console.log("Inside DI-20990 Test");
  let a;
  try {
    a = await pepperi.slugs.getPage("djfgvsdahfigsdi");
    // await pepperi.addons.api.uuid("2b39d63e-0982-4ada-8cbb-737b03b9ee58").post(opt);
  } catch (ex) {
    const z = ex;
  }
  res.json({
    currentResults: a,
  });
});

router.get("/DI", async (req, res, next) => {
  debugger;
  pepperi.events.intercept(
    "TSAButtonPressed",
    { FieldID: "sixthTrigger" },
    async (data, next, main) => {
      debugger;
      console.log(
        "InterceptorActionsTest:: sixthTrigger - Inside first main"
      );
      const res = await data.client?.captureGeoLocation({
        accuracy: "Medium",
        maxWaitTime: 400,
      });
      actionsArr.push(JSON.stringify(res));
    }
  );

  pepperi.events.intercept(
    "TSAButtonPressed",
    { FieldID: "sixthTrigger" },
    async (data, next, main) => {
      debugger;
      console.log(
        "InterceptorActionsTest:: sixthTrigger - Inside second main"
      );
      data.client
        ?.captureGeoLocation({ accuracy: "High", maxWaitTime: 1000 })
        .then((res) => {
          console.log("InterceptorActionsTest:: sixthTrigger - Inside then");
          actionsArr.push(JSON.stringify(res));
        });
      try {
        const upsert = await pepperi.api.userDefinedTables.upsert({
          table: "actionsSequence",
          mainKey: new Date().toISOString(),
          secondaryKey: "TestResults",
          value: actionsArr.toString(),
        });
        console.log(upsert);
      } catch (err) {
        console.log(err);
      }
    }
  );
  const res2 = await pepperi.events.emit(
    'TSAButtonPressed',
    { FieldID: "sixthTrigger" }
  )
  debugger;
});

router.get("/DI-21502", async (req, res, next) => {
  debugger;
  let respGet;
  let resp;
  try {
    // respGet = await pepperi.api.adal.get({
    //   addon: "2b39d63e-0982-4ada-8cbb-737b03b9ee58", // mandatory
    //   table: "UpsertTest", // mandatory
    //   key: "evgeny11",
    // });
    resp = await pepperi.api.adal.upsert({
      addon: "2b39d63e-0982-4ada-8cbb-737b03b9ee58", // mandatory
      table: "UpsertTestLatest", // mandatory
      indexedField: '', // optional
      object: {
        Key: "evgeny11",
        evgeny: "aaaaaaaa"
      },
    });
    debugger;
  } catch (ex) {
    const a = ex;
    debugger;
  }
  res.json({
    currentResults: resp,
  });

});

router.get("/zozo", async (req, res, next) => {
  res.json(15);
});


router.get("/DI-21871", async (req, res, next) => {
  await pepperi.resources.resource('resources').key("TestUDC").get();
});


router.get("/DI-23750", async (req, res, next) => {//evgeny 222
  debugger;
  const runFlowObject: FlowObject = {
    FlowKey: 'c3a44b77-f419-4c2a-a78b-118c9beb5b26',
    FlowParams: {}
    //     Param1: {
    //         Source: 'Dynamic',
    //         Value: 'someValue'
    //     }
    // }
  };
  let res2;
  try {
    res2 = await pepperi.flows.run({
      RunFlow: runFlowObject,
      Data: {},
    });
  } catch (error) {
    debugger;
  }
  console.log('EVGENY: ' + res2);
  debugger;
});

router.get("/new_test", async (req, res, next) => {//evgeny 222
  debugger;
  let errorMessage = "";
  let resp;
  try {
    resp = await pepperi.addons.data.schemes.uuid("dc8c5ca7-3fcc-4285-b790-349c7f3908bd").name("flows").get();
  } catch (error) {
    errorMessage = (error as any).message;
    debugger;
  }
  debugger;
});

router.get("/DI-21685", async (req, res, next) => {
  let resp;
  let errorMessage;
  try {
    debugger;
    resp = await pepperi.resources.resource('resources').search({});
    const z = resp.filter(collection => collection.Name.includes("survey"));
    debugger;
  } catch (error) {
    debugger;
    errorMessage = (error as any).message;
  }
  debugger;
});

router.get("/DI-21834", async (req, res, next) => {
  debugger;
  const a = await pepperi.addons.data.relations.pageBlocks();
  const b = await pepperi.addons.data.relations.addonBlocks();
  const c = (await pepperi.addons.data.relations.pageBlocks())[0].AddonBaseURL;
  console.log(`a:${a}, b:${b}, c:${c}`);
  debugger;
});

router.get("/DI-21858", async (req, res, next) => {
  debugger;
  let errorMessage = "";
  let resp;
  try {
    resp = await pepperi.addons.data.schemes.uuid("dd0a85ea-7ef0-4bc1-b14f-959e0372877a").name("base_surveys").get();
  } catch (error) {
    errorMessage = (error as any).message;
  }
  debugger;
});

router.get("/DI-22185", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      let errorMessage = "";
      const addonUUID = "fc5a5974-3b30-4430-8feb-7d5b9699bc9f";//Generic Resource addon UUID as hes the owner
      let a;
      debugger;
      try {
        a = await pepperi.addons.papi.uuid(addonUUID).resource('accounts').search({});//{ Where: "City='Rostock'" }
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage, `got error message:${errorMessage}`).to.equal("");
      expect(a.Objects.length, "response array is empty").to.be.above(0);
    });
  });
  const testResult = await run();
  res.json(testResult);
});


router.get("/DI-22239", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      let errorMessage = "";
      const addonUUID = "fc5a5974-3b30-4430-8feb-7d5b9699bc9f";//Generic Resource addon UUID as hes the owner
      let a;
      debugger;
      try {
        a = await pepperi.addons.papi.uuid(addonUUID).resource('accounts').search({});//{ Where: "City='Rostock'" }
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage, `got error message:${errorMessage}`).to.equal("");
      expect(a.Objects.length, "response array is empty").to.be.above(0);
    });
  });
  const testResult = await run();
  res.json(testResult);
});

// (event: import("./events").EventKey, data: any, context?: import("./events").IContext | undefined) => Promise<{
//   data: any;
// }>;



router.get("/DI-20880", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      debugger;
      const a = await pepperi.events.emit(
        'evgeny' as EventKey,
        {
          ObjectType: "Array123"
        }
      );
      debugger;
      console.log(a);
    });
  });
  const testResult = await run();
  res.json(testResult);
});


router.get("/DI-22441", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('MySurveys').search({});
        debugger;
      } catch (error) {
        errorMessage = (error as any).message;
        debugger;
      }
      console.log(errorMessage);
      console.log(resp);
    });
  });
  const testResult = await run();
  res.json(testResult);
});

// 
router.get("/evg1", async (req, res, next) => {
  debugger;
  const obj = await pepperi.DataObject.Get("TransactionLine", "88989e12-5971-4a6e-be7d-1583a399e1dd");
  obj!.setFieldValue('TSAEventData', 123);
  debugger;
});

router.get("/DI-22688", async (req, res, next) => {
  debugger;
  const x = await pepperi.events.emit('Bulx2' as EventKey,
    {
      ObjectType: "Sales Order"
    }
  );
  console.log(x);
  debugger;
});

router.get("/DI-22810", async (req, res, next) => {
  debugger;
  const user = await (await pepperi.environment.user()).email;
  const user1 = await (await pepperi.environment.user()).externalID;
  const user2 = await (await pepperi.environment.user()).internalID;
  const user3 = await (await pepperi.environment.user()).externalID;
  const user4 = await (await pepperi.environment.user()).firstName;
  const user5 = await (await pepperi.environment.user()).lastName;
  console.log(user);
  console.log(user2);
  console.log(user3);
  console.log(user4);
  console.log(user5);
  debugger;
});



router.get("/DI-22037", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      const catalogResponseGet = await pepperi.api.catalogs.get({ key: { UUID: "ed1cc3e0-d316-4246-a094-9337dfc8d942" }, fields: ["InternalID", "ExternalID"] });
      expect(catalogResponseGet.object.InternalID).to.equal(79720);
      expect(catalogResponseGet.object.ExternalID).to.equal("Default Catalog");
      debugger;
      let catalogResponseSearch;
      let error = "";
      try {
        catalogResponseSearch = await pepperi.api.catalogs.search({ fields: ["InternalID", "ExternalID", "CreationDateTime"] });
      } catch (e) {
        error = (e as any).message;
        debugger;
      }
      debugger;
      expect(catalogResponseSearch.success).to.equal(true);
      expect(catalogResponseSearch.page).to.equal(1);
      expect(catalogResponseSearch.count).to.equal(1);
      expect(catalogResponseSearch.objects.length).to.equal(1);
      expect(catalogResponseSearch.objects[0].InternalID).to.equal(79720);
      expect(catalogResponseSearch.objects[0].ExternalID).to.equal("Default Catalog");
    });
  });
  const testResult = await run();
  res.json(testResult);
});


router.get("/DI-22226", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      let catalogResponseGet;
      let error;
      try {
        debugger;
        catalogResponseGet = await pepperi.resources.resource('account_users').search({});
      } catch (e) {
        error = (e as any).message;
        debugger;
      }
      debugger;
      console.log(catalogResponseGet);
      // let catalogResponseSearch;
      // let error = "";
      // try {
      //   catalogResponseSearch = await pepperi.api.catalogs.search({ fields: ["InternalID", "ExternalID", "CreationDateTime"] });
      // } catch (e) {
      //   error = (e as any).message;
      //   debugger;
      // }
      // debugger;
      // expect(catalogResponseSearch.success).to.equal(true);
      // expect(catalogResponseSearch.page).to.equal(1);
      // expect(catalogResponseSearch.count).to.equal(1);
      // expect(catalogResponseSearch.objects.length).to.equal(1);
      // expect(catalogResponseSearch.objects[0].InternalID).to.equal(79720);
      // expect(catalogResponseSearch.objects[0].ExternalID).to.equal("Default Catalog");
    });
  });
  const testResult = await run();
  res.json(testResult);
});


router.get("/DI-22079", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      let error = '';
      let accResponseGet;
      let accResponseSearch;
      try {
        accResponseGet = await pepperi.api.accounts.get({ key: { UUID: "c19ce981-1113-48d4-af66-259c6e74985e" }, fields: ["InternalID", "City", "Country"] });
      } catch (e) {
        error = (e as any).message;
      }
      expect(error).to.equal('');
      expect(accResponseGet.success).to.equal(true);
      expect(accResponseGet.object.InternalID).to.equal(24095345);
      expect(accResponseGet.object.City).to.equal("New York");
      expect(accResponseGet.object.Country).to.equal("USA");
      error = '';
      try {
        accResponseSearch = await pepperi.api.accounts.search({ fields: ["InternalID", "City", "Country"] }) as any;
      } catch (e) {
        error = (e as any).message;
      }
      expect(accResponseSearch.success).to.equal(true);
      expect(accResponseSearch.page).to.equal(1);
      expect(accResponseSearch.count).to.equal(2);
      expect(accResponseSearch.objects.length).to.equal(2);
      for (let index = 0; index < accResponseSearch.objects.length; index++) {
        const element = accResponseSearch.objects[index];
        expect(element.InternalID).to.be.oneOf([24095356, 24095345]);
        expect(element.Country).to.be.oneOf(["USA", "-"]);
        expect(element.City).to.be.oneOf(["Raanana", "New York"]);
      }
    });
  });
  const testResult = await run();
  res.json(testResult);
});



router.get("/pfs_cpi", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.pfs testing - cpi side", async () => {
    const assetsUUID = "ad909780-0c23-401e-8e8e-f514cc4f6aa2";
    const assetsSchemaName = "Assets";
    it("positive test: addons.pfs.uuid.schema.find - get all Assets Files", async () => {
      const pfsResponse = await pepperi.addons.pfs.uuid(assetsUUID).schema(assetsSchemaName).find({}) as any;
      expect(pfsResponse.length).to.equal(3);
      for (let index = 0; index < pfsResponse.length; index++) {
        const element = pfsResponse[index];
        expect(element).to.haveOwnProperty("CreationDateTime");
        expect(element).to.haveOwnProperty("Description");
        expect(element).to.haveOwnProperty("Folder");
        expect(element).to.haveOwnProperty("Hidden");
        expect(element.Hidden).to.equal(false);
        expect(element).to.haveOwnProperty("Key");
        expect(element.Key).to.be.oneOf(['folder123/', 'folder123/Switch_by_Sam_Perkins.png', 'images.png']);
        expect(element).to.haveOwnProperty("MIME");
        expect(element).to.haveOwnProperty("Name");
        expect(element.Name).to.be.oneOf([element.Key, element.Key.substring(element.Key.indexOf('/') + 1)]);
        expect(element).to.haveOwnProperty("Sync");
        if (element.Name !== 'folder123/') {
          expect(element).to.haveOwnProperty("UploadedBy");
          expect(element.UploadedBy).to.be.oneOf(['dd7cb027-24e4-4099-a356-c91c5f4b0c62', '416f409d-a06e-4d13-9585-a1ad2d52c598']);
        }
        expect(element).to.haveOwnProperty("URL");
      }
    });
    it("positive test: addons.pfs.uuid.schema.key.get - get Assets File by a key", async () => {
      const pfsResponse = await pepperi.addons.pfs.uuid("ad909780-0c23-401e-8e8e-f514cc4f6aa2").schema('Assets').key("images.png").get();
      expect(pfsResponse).to.haveOwnProperty("ModificationDateTime");
      expect(pfsResponse).to.haveOwnProperty("FileVersion");
      expect(pfsResponse).to.haveOwnProperty("Folder");
      expect(pfsResponse.Folder).to.equal("/");
      expect(pfsResponse.MIME).to.equal("image/png");
      expect(pfsResponse).to.haveOwnProperty("CreationDateTime");
      expect(pfsResponse).to.haveOwnProperty("Sync");
      expect(pfsResponse.URL).to.include("pfs");
      expect(pfsResponse.Hidden).to.equal(false);
      expect(pfsResponse.Cache).to.equal(true);
      expect(pfsResponse.FileSize).to.equal(17962);
      expect(pfsResponse.UploadedBy).to.be.oneOf(['dd7cb027-24e4-4099-a356-c91c5f4b0c62', '416f409d-a06e-4d13-9585-a1ad2d52c598']);
      expect(pfsResponse.Name).to.equal("images.png");
      expect(pfsResponse.Key).to.equal("images.png");
    });
    it("positive test: addons.pfs.uuid.schema.find - get all Assets files under certain folder", async () => {
      const pfsResponse = await pepperi.addons.pfs.uuid(assetsUUID).schema(assetsSchemaName).find({ folder: "folder123" });
      expect(pfsResponse.length).to.equal(1);
      const parsedResponse = pfsResponse[0];
      expect(parsedResponse).to.haveOwnProperty("ModificationDateTime");
      expect(parsedResponse).to.haveOwnProperty("FileVersion");
      expect(parsedResponse).to.haveOwnProperty("Folder");
      expect(parsedResponse.Folder).to.equal("folder123/");
      expect(parsedResponse.MIME).to.equal("image/png");
      expect(parsedResponse).to.haveOwnProperty("CreationDateTime");
      expect(parsedResponse).to.haveOwnProperty("Sync");
      expect(parsedResponse.URL).to.include("pfs");
      expect(parsedResponse.Hidden).to.equal(false);
      expect(parsedResponse.Cache).to.equal(true);
      expect(parsedResponse.FileSize).to.equal(117004);
      expect(parsedResponse.UploadedBy).to.be.oneOf(['dd7cb027-24e4-4099-a356-c91c5f4b0c62', '416f409d-a06e-4d13-9585-a1ad2d52c598']);
      expect(parsedResponse.Name).to.equal("Switch_by_Sam_Perkins.png");
      expect(parsedResponse.Key).to.equal("folder123/Switch_by_Sam_Perkins.png");
    });
  });
  const testResult = await run();
  res.json(testResult);
});


router.get("/DI-21785", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      debugger;
      const a = await pepperi.addons.pfs.uuid("ad909780-0c23-401e-8e8e-f514cc4f6aa2").schema('Assets').find({});
      debugger;
      console.log(a);
    });
  });
  const testResult = await run();
  res.json(testResult);
});


router.get("/DI-21877", async (req, res, next) => {
  const addonUUID = "2b39d63e-0982-4ada-8cbb-737b03b9ee58";
  debugger;
  let errorMessage = "";
  let resp;
  try {
    resp = await pepperi.addons.data.uuid(addonUUID).table("cpiAdalTest3").search({ Where: "CreationDateTime='2022-11-30T13:56:27.673Z'" });
  } catch (error) {
    errorMessage = (error as any).message;
  }
});

router.get("/DI-22184", async (req, res, next) => {
  debugger;
  let errorMessage = "";
  let resp;
  try {
    resp = await pepperi.addons.papi.uuid("accounts")
  }
  catch (error) {
    errorMessage = (error as any).message;
    debugger;
  }
  debugger;
});

router.get("/DI-21737", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      debugger;
      const a = await pepperi.addons.pfs.uuid("ad909780-0c23-401e-8e8e-f514cc4f6aa2").schema('Assets').key("images.png").get();
      debugger;
      console.log(a);
    });
  });
  const testResult = await run();
  res.json(testResult);
});

router.get("/DI-21784", async (req, res, next) => {
  const { describe, it, expect, run } = Tester("My test");
  describe("addons.papi testing - cpi side", async () => {
    it("addons.papi.uuid test", async () => {
      debugger;
      const a = await pepperi.addons.pfs.uuid("ad909780-0c23-401e-8e8e-f514cc4f6aa2").schema('Assets').find({ folder: "folder123" });
      debugger;
      console.log(a);
    });
  });
  const testResult = await run();
  res.json(testResult);
});

router.get("/DI-22336", async (req, res, next) => {
  //EVGENY
  const options: any = {
    Key: "Value",
    Value: "1234"
  };
  let errorMessage = "";
  let resp;
  try {
    resp = await pepperi.addons.data.uuid(addonUUID).table("test333").upsert(options);
    debugger;
  } catch (error) {
    errorMessage = (error as any).message;
    debugger;
  }
});


router.get("/Cpi_Adal", async (req, res, next) => {
  let GUID = "";
  let randKey = "";
  const addonUUID = "2b39d63e-0982-4ada-8cbb-737b03b9ee58";
  const tableName = "cpiAdalTest3";
  const { describe, it, expect, run } = Tester("My test");
  describe("cpi adal tests", async () => {
    it("addons.data.schemes - negative test: getting non existing scheme", async () => {
      let errorMessage;
      try {
        await pepperi.addons.data.schemes.uuid(addonUUID).name("NOT EXISTING").get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal(`Could not find object with key: '${addonUUID}_NOT EXISTING' on table: 'schemes'`);
    });
    it("pepperi.addons.schemes.get - positive test: getting all sync: true schemes", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.schemes.get({});
      }
      catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.length).to.above(7);
      for (let index = 0; index < resp.length; index++) {
        const scheme = resp[index];
        expect(scheme.Hidden).to.equal(false);
        expect(scheme.Type).to.be.oneOf(["papi", "meta_data", "data", "abstract", "contained"]);
        expect(scheme.SyncData.Sync).to.equal(true);
      }
    });
    it("addons.data.schemes - positive test: getting existing scheme", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.schemes.uuid(addonUUID).name(tableName).get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.GenericResource).to.equal(false);
      expect(resp.AddonUUID).to.equal(addonUUID);
      expect(resp.Hidden).to.equal(false);
      expect(resp.Key).to.equal(`${addonUUID}_${tableName}`);
      expect(resp.Name).to.equal(tableName);
      expect(resp.SyncData.Sync).to.equal(true);
      expect(resp.Fields.Value.Type).to.equal("string");
    });
    it("addons.data.uuid.table.key - negative test: getting not existing key", async () => {
      // debugger;
      let errorMessage = "";
      try {
        await pepperi.addons.data.uuid(addonUUID).table(tableName).key("NON").get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.include(`Error thrown: ClientApiError: Could not find object with key: 'NON' on table: '${tableName}'`);
    });
    it("addons.data.uuid.table.key - positive test: getting existing key: full object", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).key("test1").get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Hidden).to.equal(false);
      expect(resp.Key).to.equal("test1");
      expect(resp.Value).to.equal("abc1");
    });
    it("addons.data.uuid.table.search - positive test: testing the search is case sensitive", async () => {
      let errorMessage = "";
      let respShouldHaveData;
      let respNoData;
      try {
        respShouldHaveData = await pepperi.addons.data.uuid(addonUUID).table("Di22006").search({});
        respNoData = await pepperi.addons.data.uuid(addonUUID).table("di22006").search({});
      } catch (error) {
        errorMessage = (error as any).message;

      }
      expect(errorMessage).to.equal("");
      expect(respShouldHaveData.Objects[0].ValueA).to.equal("evgey");
      expect(respShouldHaveData.Objects[0].Hidden).to.equal(false);
      expect(respShouldHaveData.Objects[0]).to.haveOwnProperty("CreationDateTime");
      expect(respShouldHaveData.Objects[0]).to.haveOwnProperty("ModificationDateTime");
      expect(respShouldHaveData.Objects[0]).to.haveOwnProperty("Key");
      expect(respNoData.Objects).to.deep.equal([]);
    });
    it("addons.data.uuid.table.search - positive test: using 'search' to 'sort_by' key", async () => {
      const options: AddonsDataSearchParams = {
        SortBy: "Key"
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search(options);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      const keys: string[] = [];
      for (let index = 0; index < resp.Objects.length; index++) {
        const element = resp.Objects[index];
        keys.push(element.Key);
      }
      expect(errorMessage).to.equal("");
      expect(keys).to.be.ordered;
    });
    it("addons.data.uuid.table.search - positive test: using 'search' to set which 'Fields' are returning partial object(key - value - hidden)", async () => {
      const options: AddonsDataSearchParams = {
        Fields: ["Key", "Value", "Hidden"]
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search(options);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const data = resp.Objects;
      for (let index = 0; index < data.length; index++) {
        const element = data[index];
        if (element.Hidden == false)
          expect(element).to.include.all.keys("Key", "Value", "Hidden");
      }
    });
    it("addons.data.uuid.table.search - negative test: using broken search options and validating the error is good", async () => {
      const options = {
        Where: "Key is Like 'test%25'"
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search(options);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.include("Could not parse where clause 'Key is Like 'test%25'' on scheme 'cpiAdalTest3");
    });
    it("addons.data.uuid.table.upsert - positive test: using 'upsert' to change exsisting object (using exsisting key)", async () => {
      //evgeny hayom
      const options: any = {
        Key: "test3",
        Value: "abc4"
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).upsert(options);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Key).to.equal("test3");
      expect(resp.Value).to.equal("abc4");
      const optionsToSend: any = {
        Key: "test3",
        Value: "abc3"
      };
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).upsert(optionsToSend);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Key).to.equal("test3");
      expect(resp.Value).to.equal("abc3");
    });
    it("addons.data.uuid.table.upsert - positive test: using 'upsert' w.o. a key - should create new object with GUID as key", async () => {
      const options: any = {
        Value: "abc_GUID"
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).upsert(options);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Value).to.equal("abc_GUID");
      GUID = resp.Key;
    });
    it("addons.data.uuid.table.upsert - positive test: using 'upsert' with non exsisting random key - should create new object with this random value as key", async () => {
      randKey = `rand_${Math.floor(Math.random() * 10)}`;
      const options: any = {
        Key: randKey,
        Value: "abc_Rand"
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).upsert(options);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Key).to.equal(randKey);
      expect(resp.Value).to.equal("abc_Rand");
    });
    it("addons.data.uuid.table.key - positive test: getting upserted keys", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).key(GUID).get();
      } catch (error) {
        errorMessage = (error as any).message;
        // debugger;
      }
      // debugger;
      expect(errorMessage).to.equal("");
      expect(resp.Value).to.equal("abc_GUID");
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).key("test3").get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Value).to.equal("abc3");
    });
    it("addons.data.uuid.table.search - positive test: filtering get using where clause on Keys", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search({ Where: "Key Like 'test%'" });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const arrayOfReturnals = resp.Objects;
      expect(arrayOfReturnals.length).to.equal(4);
      for (let index = 0; index < arrayOfReturnals.length; index++) {
        const dataReturned = arrayOfReturnals[index];
        expect(dataReturned.Key).to.equal(`test${index + 1}`);
        expect(dataReturned.Value).to.equal(`abc${index + 1}`);
      }
    });
    it("addons.data.uuid.table.search - positive test: filtering get using where clause on CreationDateTime", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search({ Where: "CreationDateTime > '2023-06-18:00:00:00.000Z' AND Key Like 'test%'" });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const arrayOfReturnals = resp.Objects;
      expect(arrayOfReturnals.length).to.equal(4);
      for (let index = 0; index < arrayOfReturnals.length; index++) {
        const dataReturned = arrayOfReturnals[index];
        expect(dataReturned.Key).to.equal(`test${index + 1}`);
        expect(dataReturned.Value).to.equal(`abc${index + 1}`);
      }
    });
    it("addons.data.uuid.table.search - positive test: using keyList inside where to filter the data", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search({ KeyList: ["test1", "test2"] });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const arrayOfReturnals = resp.Objects;
      expect(arrayOfReturnals.length).to.equal(2);
      for (let index = 0; index < arrayOfReturnals.length; index++) {
        const dataReturned = arrayOfReturnals[index];
        expect(dataReturned.Key).to.equal(`test${index + 1}`);
        expect(dataReturned.Value).to.equal(`abc${index + 1}`);
      }
    });
    it("addons.data.uuid.table.search - DI-22861 Verification: KeyList throws exception when sending key that does not exist", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search({ KeyList: ["nonExsistingKEY123"] });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Objects.length).to.equal(0);
    });
    it("addons.data.uuid.table.search - positive test: filtering get using where clause on Hidden to get all Hidden data counted with page size = -1", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).search({ Where: "Hidden=true", "IncludeCount": true, "PageSize": -1 });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const arrayOfReturnals = resp.Objects;
      //TODO: include count wrong number returned 
      expect(resp.Count).to.equal(arrayOfReturnals.length);
      for (let index = 0; index < arrayOfReturnals.length; index++) {
        const dataReturned = arrayOfReturnals[index];
        expect(dataReturned.Hidden).to.equal(true);
      }
    });
    it("addons.data.uuid.table.upsert - positive test: cleanse upserted data and test indeed hidden", async () => {
      const options: any = {
        Key: GUID,
        Hidden: true
      };
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).upsert(options);
      } catch (error) {
        errorMessage = (error as any).message;
        // debugger;
      }
      // debugger;
      expect(errorMessage).to.equal("");
      expect(resp.Key).to.equal(GUID);
      expect(resp.Hidden).to.equal(true);
      const options2: any = {
        Key: randKey,
        Hidden: true
      };
      try {
        resp = await pepperi.addons.data.uuid(addonUUID).table(tableName).upsert(options2);
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Key).to.equal(randKey);
      expect(resp.Hidden).to.equal(true);
    });
    it("pepperi.resources.resource('resources') - positive test: getting ALL generic resurce by unfiltered search", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('resources').search({});
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Objects.length).to.be.above(3);
      for (let index = 0; index < resp.Objects.length; index++) {
        const genericResource = resp.Objects[index];
        expect(genericResource.GenericResource).to.equal(true);
        expect(genericResource.Hidden).to.equal(false);
      }
    });
    it("pepperi.resources.resource('resources') - positive test: getting generic resurce scheme by key", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('resources').key("genericresourcetest").get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.AddonUUID).to.equal(addonUUID);
      expect(resp.GenericResource).to.equal(true);
      expect(resp.Hidden).to.equal(false);
      expect(resp.Key).to.equal(`${addonUUID}_genericresourcetest`);
      expect(resp.Name).to.equal(`genericresourcetest`);
      expect(resp.SyncData.Sync).to.equal(true);
      expect(resp.Type).to.equal("data");
      expect(resp.Fields.Value.Type).to.equal("string");
    });
    it("pepperi.resources.resource('resources') - positive test: getting UDC scheme by key", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('resources').key("TestUDC").get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      // debugger;
      expect(errorMessage).to.equal("");
      expect(resp.AddonUUID).to.equal('122c0e9d-c240-4865-b446-f37ece866c22');
      expect(resp.GenericResource).to.equal(true);
      expect(resp.Hidden).to.equal(false);
      expect(resp.Key).to.equal(`122c0e9d-c240-4865-b446-f37ece866c22_TestUDC`);
      expect(resp.Name).to.equal(`TestUDC`);
      expect(resp.SyncData.Sync).to.equal(true);
      expect(resp.Type).to.equal("data");
      expect(resp.Fields.a.Type).to.equal("String");
      expect(resp.Fields.a.Mandatory).to.equal(false);
      expect(resp.UserDefined).to.equal(true);
      expect(resp.DocumentKey.Delimiter).to.equal("@");
      expect(resp.DocumentKey.Type).to.equal("AutoGenerate");
      expect(resp.DocumentKey.Fields).to.deep.equal([]);
    });
    it("pepperi.resources.resource('resources') - positive test: getting UDC by calling unique and using the name", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('resources').unique("Name").get("TestUDC");
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.AddonUUID).to.equal('122c0e9d-c240-4865-b446-f37ece866c22');
      expect(resp.GenericResource).to.equal(true);
      expect(resp.Hidden).to.equal(false);
      expect(resp.Key).to.equal(`122c0e9d-c240-4865-b446-f37ece866c22_TestUDC`);
      expect(resp.Name).to.equal(`TestUDC`);
      expect(resp.SyncData.Sync).to.equal(true);
      expect(resp.Type).to.equal("data");
      expect(resp.Fields.a.Type).to.equal("String");
      expect(resp.Fields.a.Mandatory).to.equal(false);
      expect(resp.UserDefined).to.equal(true);
      expect(resp.DocumentKey.Delimiter).to.equal("@");
      expect(resp.DocumentKey.Type).to.equal("AutoGenerate");
      expect(resp.DocumentKey.Fields).to.deep.equal([]);
    });
    it("pepperi.resources.resource('resources').search - positive test: getting UDC by using name search", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('resources').search({ Where: "Name=TestUDC", IncludeCount: true });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Count).to.equal(resp.Objects.length);
      const gottenData = resp.Objects[0];
      expect(gottenData.AddonUUID).to.equal('122c0e9d-c240-4865-b446-f37ece866c22');
      expect(gottenData.GenericResource).to.equal(true);
      expect(gottenData.Hidden).to.equal(false);
      expect(gottenData.Key).to.equal(`122c0e9d-c240-4865-b446-f37ece866c22_TestUDC`);
      expect(gottenData.Name).to.equal(`TestUDC`);
      expect(gottenData.SyncData.Sync).to.equal(true);
      expect(gottenData.Type).to.equal("data");
      expect(gottenData.Fields.a.Type).to.equal("String");
      expect(gottenData.Fields.a.Mandatory).to.equal(false);
      expect(gottenData.UserDefined).to.equal(true);
      expect(gottenData.DocumentKey.Delimiter).to.equal("@");
      expect(gottenData.DocumentKey.Type).to.equal("AutoGenerate");
      expect(gottenData.DocumentKey.Fields).to.deep.equal([]);
    });
    it("pepperi.resources.resource('resources') - negative test: getting UDC by calling unique and using random UUID testing error message", async () => {
      let errorMessage = "";
      let resp;
      const uuidRand = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
      try {
        resp = await pepperi.resources.resource('resources').key(uuidRand).get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(resp.fault.faultstring).to.include("Failed due to exception: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx scheme does not exist");
    });
    it("pepperi.resources.resource('UDC').get - positive test: getting all fields - no filter, validating data is correct", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').get({});
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      for (let index = 0; index < resp.length; index++) {
        const udcField = resp[index];
        if (udcField.Hidden === false) {
          expect(udcField).to.haveOwnProperty("CreationDateTime");
          expect(udcField).to.haveOwnProperty("ModificationDateTime");
          expect(udcField).to.haveOwnProperty("Key");
          expect(udcField.Key.length).to.equal(36);
          expect(udcField).to.haveOwnProperty("a");
          expect(udcField.a).to.include("test_udc_field");
        } else {
          expect(udcField).to.haveOwnProperty("Key");
          expect(udcField.Key.length).to.equal(36);
        }
      }
    });
    it("pepperi.resources.resource('UDC').search - positive test: using UDC as the 'proxy resource': getting all fields (no filter), validating data is correct", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').search({});
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      for (let index = 0; index < resp.length; index++) {
        const udcField = resp[index];
        if (udcField.Hidden === false) {
          expect(udcField).to.haveOwnProperty("CreationDateTime");
          expect(udcField).to.haveOwnProperty("ModificationDateTime");
          expect(udcField).to.haveOwnProperty("Key");
          expect(udcField.Key.length).to.equal(36);
          expect(udcField).to.haveOwnProperty("a");
          expect(udcField.a).to.include("test_udc_field");
        }
        else {
          expect(udcField).to.haveOwnProperty("Key");
          expect(udcField.Key.length).to.equal(36);
        }
      }
    });
    it("pepperi.resources.resource('UDC').search - positive test: using UDC as the 'proxy resource': using 'where' to filter collection and getiting a list of certain fields by name", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').search({ Where: "a like '%evgeny'" });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const gottenData = resp.Objects[0];
      expect(gottenData).to.haveOwnProperty("CreationDateTime");
      expect(gottenData).to.haveOwnProperty("ModificationDateTime");
      expect(gottenData).to.haveOwnProperty("Key");
      expect(gottenData.Key).to.be.oneOf(["3e67c8af-34cb-4c7b-a238-3486a2f4bcad", "d0828e5a-cb21-424a-b41a-4538c5139cc1", "69de7517-20d4-40d1-8c6c-4e78fde42305", "d819f405-4544-444e-8a91-e999c3c5def4"]);
      expect(gottenData).to.haveOwnProperty("a");
      expect(gottenData.a).to.equal("test_udc_field_evgeny");
    });
    it("pepperi.resources.resource('UDC').search - positive test: using UDC as the 'proxy resource': using 'IncludeCount' - testing the number is correct", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').search({ IncludeCount: true });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.Objects.length).to.equal(resp.Count);
      const gottenData = resp.Objects[0];
      expect(gottenData).to.haveOwnProperty("CreationDateTime");
      expect(gottenData).to.haveOwnProperty("ModificationDateTime");
      expect(gottenData).to.haveOwnProperty("Key");
      expect(gottenData).to.haveOwnProperty("a");
    });
    it("pepperi.resources.resource('UDC').post - positive test: using UDC as the 'proxy resource': posting a field and validating response", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').post({ a: "test_udc_field_from_CPI" });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp).to.haveOwnProperty("Key");
      expect(resp.Key.length).to.equal(36);
      randKey = resp.Key;
      expect(resp).to.haveOwnProperty("a");
      expect(resp.a).to.equal("test_udc_field_from_CPI");
    });
    it("pepperi.resources.resource('UDC').post - positive test: posting 'hidden=true' to hide created field on collection", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').post({ Key: randKey, Hidden: true });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp).to.haveOwnProperty("Key");
      expect(resp.Key.length).to.equal(36);
      expect(resp.Key).to.equal(randKey);
      expect(resp.Hidden).to.equal(true);
    });
    it("pepperi.resources.resource('UDC').post - positive test: getting all fields no filter to see whether the field is indeed deleted", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('TestUDC').get({});
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      for (let index = 0; index < resp.length; index++) {
        const udcField = resp[index];
        if (udcField.Hidden === false) {
          expect(udcField.a).to.not.equal("test_udc_field_from_CPI");
        }
      }
    });
    it("pepperi.resources.resource('UDC').post - negative test: trying to post to scheme only collection", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('SchemeOnlyUDC').post({ a: "abc" });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.include("SchemeOnlyUDC not found");
    });
    it("pepperi.resources.resource('UDC').post - positive test: trying to GET a scheme only collection", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.addons.data.schemes.uuid('122c0e9d-c240-4865-b446-f37ece866c22').name('SchemeOnlyUDC').get();
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      expect(resp.GenericResource).to.equal(true);
      expect(resp.AddonUUID).to.equal("122c0e9d-c240-4865-b446-f37ece866c22");
      expect(resp.Hidden).to.equal(false);
      expect(resp.Name).to.equal('SchemeOnlyUDC');
      expect(resp.SyncData.Sync).to.equal(true);
      expect(resp.Fields.a.Type).to.equal("String");
    });
    it("pepperi.resources.resource('resources').search - positive test: using UDC as the 'proxy resource': trying to GET online only scheme", async () => {
      let errorMessage = "";
      let resp;
      try {
        resp = await pepperi.resources.resource('resources').search({ Where: "Name=OnlineUDC" });
      } catch (error) {
        errorMessage = (error as any).message;
      }
      expect(errorMessage).to.equal("");
      const recivedCollection = resp;
      expect(recivedCollection.Objects).to.deep.equal([]);
    });
  });
  const testResult = await run();
  res.json(testResult);
});

router.post("/zozop", async (req, res, next) => {
  res.json({ requestBody: req.body });
});

//==========================TransactionScope tests===================================
//Leave this test here,it takes gloabl variables that gets valued on the Load function
//test for the TrnScope functions and interceptors - debug here and not on server side - make sure the test trigger is set to true inside load function
router.get("/TransactionScope", async (req, res, next) => {
  debugger;
  console.log(
    "TransactionScopeTester:: Started TransactionScope automation test"
  );
  const { describe, it, expect, run } = Tester("My test");
  //setting up objects
  let accRes = await pepperi.app.accounts.add({
    type: { Name: "Customer" },
    object: {
      ExternalID: ExID,
      Name: ExID,
    },
  });

  const accountUUID = accRes.id;

  let apiRes = await pepperi.app.transactions.add({
    type: { Name: "Transaction Scope Sales Order" },
    references: {
      account: { UUID: accountUUID },
      catalog: { Name: "Default Catalog" },
    },
  });

  const transactionUUID = apiRes.id;
  let DataObject: Transaction | undefined = await pepperi.DataObject.Get(
    "transactions",
    transactionUUID
  );
  console.log(DataObject);
  console.log("TransactionScopeTester:: got transaction dataobject section");

  const preLoadTrnScope = DataObject?.transactionScope; //-> suppose to be undefined -> if OC not loaded should return undefined

  // let itemRes = await pepperi.api.items.get({
  //   key: { UUID: "E9AAF730-90FC-43D0-945A-A81537908F8C" }, //AQ3 // item per  environment
  //   fields: ["InternalID", "ExternalID", "UUID"],
  // });

  let itemRes = await pepperi.api.items.search({
    fields: ["UUID", "ExternalID", "InternalID"],
    filter: {
      ApiName: "ExternalID",
      FieldType: "String",
      Operation: "IsEqual",
      Values: ["AQ3"],
    },
  });
  //isInTransition -> if its in a middle of transition
  //AvailableTransition -> should return possible transition

  let itemUUID = itemRes.objects[0].UUID;

  let itemDataObject: Item | undefined = await pepperi.DataObject.Get(
    "items",
    itemUUID
  );

  const TrnScope = await pepperi.TransactionScope.Get(
    DataObject as Transaction
  ); // supposed to be equal to transaction.TrnScope after the load
  console.log("TransactionScopeTester:: got transaction scope");

  //object for OnLoadTransactionScope itself after load
  const onLoadTrnScope = DataObject?.transactionScope; //-> suppose to be equal to TrnScope

  const onLoadgetLine = await onLoadTrnScope?.getLine(itemDataObject as Item);

  const onLoadgetLines = await onLoadTrnScope?.getLines();

  const getLine = await TrnScope.getLine(itemDataObject as Item);

  const getLines = await TrnScope.getLines();

  const inTransition = await DataObject?.inTransition();

  const availableTransition = await DataObject?.availableTransitions();
  console.log(
    "TransactionScopeTester:: got all tests objects,iniating mocha.."
  );

  describe("TransactionScope automation test", async () => {
    console.log("TransactionScopeTester:: Started mocha section");

    it("preLoad Transaction Scope and Triggers sequence", async () => {
      expect(
        preLoadTrnScope,
        "Failed on TransactionScope returning a value before it loaded"
      ).that.is.undefined;
      expect(interceptorArr, "Failed on TrnScope interceptors sequence")
        .to.be.an("array")
        .with.lengthOf(2)
        .and.eql([0, 1]);
    });

    it("onLoad Transaction Scope - getLine and getLines", async () => {
      expect(TrnScope, "Failed on TrnScope that was brought via Get").to.be.an(
        "object"
      ).that.is.not.null.and.is.not.undefined;
      expect(
        TrnScope,
        "Failed on TrnScope not equals onLoadTrnScope"
      ).to.be.deep.equal(onLoadTrnScope);
      //=====================getLine======================
      expect(getLine, "Failed on getLine returning empty").to.be.an("object")
        .that.is.not.null.and.is.not.undefined;
      expect(getLine?.children, "Failed on getLine.children returning a value")
        .to.be.an("array")
        .with.lengthOf(0);
      expect(
        getLine?.hidden,
        "Failed on getLine.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        getLine?.internalID,
        "Failed on getLine.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(-1);
      expect(
        getLine?.parent,
        "Failed on getLine.parent returning a value"
      ).to.be.equal(undefined);
      expect(getLine?.resource, "Failed on resource returning the wrong value")
        .to.be.a("string")
        .that.is.equal("transaction_lines");
      expect(getLine?.uuid, "Failed on getLine.UUID retruning the wrong value")
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        getLine?.transaction,
        "Failed on getLine.Transaction returning empty"
      ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
      expect(
        getLine?.item.hidden,
        "Failed on getLine.item.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        getLine?.item.uuid,
        "Failed on getLine.item.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        getLine?.item.resource,
        "Failed on getLine.item.resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("items");
      expect(
        getLine?.item.internalID,
        "Failed on getLine.item.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(1);
      //=====================getLines======================
      expect(getLines.length, "Failed on getLines returning wrong array length")
        .to.be.an("number")
        .that.is.above(108);
      expect(getLines[0], "Failed on getLines returning empty").to.be.an(
        "object"
      ).that.is.not.null.and.is.not.undefined;
      expect(
        getLines[0]?.children.length,
        "Failed on getLines.children returning a value"
      )
        .to.be.an("number")
        .that.is.above(5);
      expect(
        getLines[0]?.hidden,
        "Failed on getLines.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        getLines[0]?.internalID,
        "Failed on getLines.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(-1);
      expect(
        getLines[0]?.parent,
        "Failed on getLines.parent returning a value"
      ).to.be.equal(undefined);
      expect(
        getLines[0]?.resource,
        "Failed on getLinesresource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("transaction_lines");
      expect(
        getLines[0]?.uuid,
        "Failed on getLines.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        getLines[0]?.transaction,
        "Failed on getLines.Transaction returning empty"
      ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
      expect(
        getLines[0]?.item.hidden,
        "Failed on getLines.item.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        getLines[0]?.item.uuid,
        "Failed on getLines.item.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        getLines[0]?.item.resource,
        "Failed on getLines.item.resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("items");
      expect(
        getLines[0]?.item.internalID,
        "Failed on getLines.item.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(1);

      expect(getLines[1], "Failed on getLines returning empty").to.be.an(
        "object"
      ).that.is.not.null.and.is.not.undefined;
      expect(
        getLines[1]?.children,
        "Failed on getLines.children returning a value"
      )
        .to.be.an("array")
        .with.lengthOf.above(5);
      expect(
        getLines[1]?.hidden,
        "Failed on getLines.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        getLines[1]?.internalID,
        "Failed on getLines.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(-1);
      expect(
        getLines[1]?.parent,
        "Failed on getLines.parent returning a value"
      ).to.be.equal(undefined);
      expect(
        getLines[1]?.resource,
        "Failed on getLinesresource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("transaction_lines");
      expect(
        getLines[1]?.uuid,
        "Failed on getLines.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        getLines[1]?.transaction,
        "Failed on getLines.Transaction returning empty"
      ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
      expect(
        getLines[1]?.item.hidden,
        "Failed on getLines.item.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        getLines[1]?.item.uuid,
        "Failed on getLines.item.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        getLines[1]?.item.resource,
        "Failed on getLines.item.resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("items");
      expect(
        getLines[1]?.item.internalID,
        "Failed on getLines.item.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(1);
      //========================onLoadedTrnScope.getLine==========================
      expect(
        onLoadTrnScope,
        "Failed on TrnScope that was brought via Get"
      ).to.be.an("object").that.is.not.null.and.is.not.undefined;
      expect(
        onLoadgetLine,
        "Failed on onLoadgetLine getLine returning empty"
      ).to.be.an("object").that.is.not.null.and.is.not.undefined;
      expect(
        onLoadgetLine?.children,
        "Failed on onLoadgetLine getLine.children returning a value"
      )
        .to.be.an("array")
        .with.lengthOf(0);
      expect(
        onLoadgetLine?.hidden,
        "Failed on onLoadgetLine getLine.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        onLoadgetLine?.internalID,
        "Failed on onLoadgetLine getLine.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(-1);
      expect(
        onLoadgetLine?.parent,
        "Failed on onLoadgetLine getLine.parent returning a value"
      ).to.be.equal(undefined);
      expect(
        onLoadgetLine?.resource,
        "Failed on onLoadgetLine resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("transaction_lines");
      expect(
        onLoadgetLine?.uuid,
        "Failed on onLoadgetLine getLine.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        onLoadgetLine?.transaction,
        "Failed on onLoadgetLine getLine.Transaction returning empty"
      ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
      expect(
        onLoadgetLine?.item.hidden,
        "Failed on onLoadgetLine getLine.item.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        onLoadgetLine?.item.uuid,
        "Failed on onLoadgetLine getLine.item.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        onLoadgetLine?.item.resource,
        "Failed on onLoadgetLine getLine.item.resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("items");
      expect(
        onLoadgetLine?.item.internalID,
        "Failed on onLoadgetLine getLine.item.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(1);
      //=====================onLoadedTrnScope.getLines======================
      expect(
        onLoadgetLines?.length,
        "Failed on getLines returning wrong array length"
      )
        .to.be.an("number")
        .that.is.above(108);
      if (onLoadgetLines) {
        expect(
          onLoadgetLines[0],
          "Failed on onLoadgetLines getLines returning empty"
        ).to.be.an("object").that.is.not.null.and.is.not.undefined;
        expect(
          onLoadgetLines[0]?.children.length,
          "Failed on onLoadgetLines getLines.children returning a value"
        )
          .to.be.an("number")
          .with.above(5);
        expect(
          onLoadgetLines[0]?.hidden,
          "Failed on onLoadgetLines getLines.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadgetLines[0]?.internalID,
          "Failed on onLoadgetLines getLines.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(-1);
        expect(
          onLoadgetLines[0]?.parent,
          "Failed on onLoadgetLines getLines.parent returning a value"
        ).to.be.equal(undefined);
        expect(
          onLoadgetLines[0]?.resource,
          "Failed on onLoadgetLines getLinesresource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("transaction_lines");
        expect(
          onLoadgetLines[0]?.uuid,
          "Failed on onLoadgetLines getLines.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadgetLines[0]?.transaction,
          "Failed on  onLoadgetLinesgetLines.Transaction returning empty"
        ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
        expect(
          onLoadgetLines[0]?.item.hidden,
          "Failed on onLoadgetLines getLines.item.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadgetLines[0]?.item.uuid,
          "Failed on onLoadgetLines getLines.item.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadgetLines[0]?.item.resource,
          "Failed on onLoadgetLines getLines.item.resource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("items");
        expect(
          onLoadgetLines[0]?.item.internalID,
          "Failed on onLoadgetLines getLines.item.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(1);

        expect(
          onLoadgetLines[1],
          "Failed on onLoadgetLines getLines returning empty"
        ).to.be.an("object").that.is.not.null.and.is.not.undefined;
        expect(
          onLoadgetLines[1]?.children.length,
          "Failed on onLoadgetLines getLines.children returning a value"
        )
          .to.be.an("number")
          .with.above(5);
        expect(
          onLoadgetLines[1]?.hidden,
          "Failed on onLoadgetLines getLines.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadgetLines[1]?.internalID,
          "Failed on onLoadgetLines getLines.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(-1);
        expect(
          onLoadgetLines[1]?.parent,
          "Failed on onLoadgetLines getLines.parent returning a value"
        ).to.be.equal(undefined);
        expect(
          onLoadgetLines[1]?.resource,
          "Failed on onLoadgetLines getLinesresource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("transaction_lines");
        expect(
          onLoadgetLines[1]?.uuid,
          "Failed on onLoadgetLines getLines.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadgetLines[1]?.transaction,
          "Failed on onLoadgetLines getLines.Transaction returning empty"
        ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
        expect(
          onLoadgetLines[1]?.item.hidden,
          "Failed on onLoadgetLines getLines.item.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadgetLines[1]?.item.uuid,
          "Failed on onLoadgetLines getLines.item.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadgetLines[1]?.item.resource,
          "Failed on onLoadgetLines getLines.item.resource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("items");
        expect(
          onLoadgetLines[1]?.item.internalID,
          "Failed on onLoadgetLines getLines.item.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(1);
      }
    });

    it("preLoad Transaction Scope - Interceptors", async () => {
      expect(preLoadGetLine, "Failed on preLoadGetLine having data").to.be.an(
        "object"
      ).that.is.not.undefined;
      expect(
        preLoadGetLines,
        "Failed on preLoadGetLines returning an array with data"
      )
        .that.is.an("array")
        .with.lengthOf.above(10).and.that.is.not.undefined;
    });

    it("onLoad Transaction Scope - Interceptors", async () => {
      //=====================getLine======================
      expect(onLoadGetLine, "Failed on onLoadGetLine returning empty").to.be.an(
        "object"
      ).that.is.not.null.and.is.not.undefined;
      expect(
        onLoadGetLine?.children,
        "Failed on onLoadGetLine.children returning a value"
      )
        .to.be.an("array")
        .with.lengthOf(0);
      expect(
        onLoadGetLine?.hidden,
        "Failed on onLoadGetLine.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        onLoadGetLine?.internalID,
        "Failed on onLoadGetLine.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(-1);
      expect(
        onLoadGetLine?.parent,
        "Failed on onLoadGetLine.parent returning a value"
      ).to.be.equal(undefined);
      expect(
        onLoadGetLine?.resource,
        "Failed on resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("transaction_lines");
      expect(
        onLoadGetLine?.uuid,
        "Failed on onLoadGetLine.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        onLoadGetLine?.transaction,
        "Failed on onLoadGetLine.Transaction returning empty"
      ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
      expect(
        onLoadGetLine?.item.hidden,
        "Failed on onLoadGetLine.item.hidden returning true"
      ).to.be.a("boolean").that.is.false;
      expect(
        onLoadGetLine?.item.uuid,
        "Failed on onLoadGetLine.item.UUID retruning the wrong value"
      )
        .to.be.a("string")
        .that.has.lengthOf(36);
      expect(
        onLoadGetLine?.item.resource,
        "Failed on onLoadGetLine.item.resource returning the wrong value"
      )
        .to.be.a("string")
        .that.is.equal("items");
      expect(
        onLoadGetLine?.item.internalID,
        "Failed on onLoadGetLine.item.internalID returning wrong value"
      )
        .to.be.a("number")
        .that.is.above(1);
      //=====================onLoadGetLines======================
      expect(
        onLoadGetLines,
        "Failed on onLoadGetLines returning wrong array length"
      )
        .to.be.an("array")
        .that.has.lengthOf.above(108);
      if (onLoadGetLines) {
        expect(
          onLoadGetLines[0],
          "Failed on onLoadGetLines returning empty"
        ).to.be.an("object").that.is.not.null.and.is.not.undefined;
        expect(
          onLoadGetLines[0]?.children.length,
          "Failed on onLoadGetLines.children returning a value"
        )
          .to.be.an("number")
          .with.above(5);
        expect(
          onLoadGetLines[0]?.hidden,
          "Failed on onLoadGetLines.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadGetLines[0]?.internalID,
          "Failed on onLoadGetLines.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(-1);
        expect(
          onLoadGetLines[0]?.parent,
          "Failed on onLoadGetLines.parent returning a value"
        ).to.be.equal(undefined);
        expect(
          onLoadGetLines[0]?.resource,
          "Failed on onLoadGetLinesresource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("transaction_lines");
        expect(
          onLoadGetLines[0]?.uuid,
          "Failed on onLoadGetLines.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadGetLines[0]?.transaction,
          "Failed on onLoadGetLines.Transaction returning empty"
        ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
        expect(
          onLoadGetLines[0]?.item.hidden,
          "Failed on onLoadGetLines.item.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadGetLines[0]?.item.uuid,
          "Failed on onLoadGetLines.item.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadGetLines[0]?.item.resource,
          "Failed on onLoadGetLines.item.resource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("items");
        expect(
          onLoadGetLines[0]?.item.internalID,
          "Failed on onLoadGetLines.item.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(1);

        expect(
          onLoadGetLines[1],
          "Failed on onLoadGetLines returning empty"
        ).to.be.an("object").that.is.not.null.and.is.not.undefined;
        expect(
          onLoadGetLines[1]?.children.length,
          "Failed on onLoadGetLines.children returning a value"
        )
          .to.be.an("number")
          .with.above(5);
        expect(
          onLoadGetLines[1]?.hidden,
          "Failed on onLoadGetLines.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadGetLines[1]?.internalID,
          "Failed on onLoadGetLines.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(-1);
        expect(
          onLoadGetLines[1]?.parent,
          "Failed on onLoadGetLines.parent returning a value"
        ).to.be.equal(undefined);
        expect(
          onLoadGetLines[1]?.resource,
          "Failed on onLoadGetLinesresource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("transaction_lines");
        expect(
          onLoadGetLines[1]?.uuid,
          "Failed on onLoadGetLines.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadGetLines[1]?.transaction,
          "Failed on onLoadGetLines.Transaction returning empty"
        ).to.be.an("object").that.is.not.undefined.and.is.not.empty;
        expect(
          onLoadGetLines[1]?.item.hidden,
          "Failed on onLoadGetLines.item.hidden returning true"
        ).to.be.a("boolean").that.is.false;
        expect(
          onLoadGetLines[1]?.item.uuid,
          "Failed on onLoadGetLines.item.UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
        expect(
          onLoadGetLines[1]?.item.resource,
          "Failed on onLoadGetLines.item.resource returning the wrong value"
        )
          .to.be.a("string")
          .that.is.equal("items");
        expect(
          onLoadGetLines[1]?.item.internalID,
          "Failed on onLoadGetLines.item.internalID returning wrong value"
        )
          .to.be.a("number")
          .that.is.above(1);
      }
    });

    it("inTransitions and availableTransition", async () => {
      expect(inTransition, "Failed on inTransition returning false").to.be.a(
        "boolean"
      ).that.is.true;
      expect(
        availableTransition,
        "Failed on availableTransition returning emoty object"
      ).to.be.an("array").that.is.not.null.and.is.not.empty;
      if (availableTransition) {
        expect(
          availableTransition[0].Title,
          "Failed on available transition's wrong title"
        )
          .to.be.a("string")
          .that.is.equal("Create");
        expect(
          availableTransition[0].UUID,
          "Failed on available transition's UUID retruning the wrong value"
        )
          .to.be.a("string")
          .that.has.lengthOf(36);
      }
    });

    //   it("Negative Trnasaction Scope tests", async () => {
    //     //1.load hidden item from transaction scope
    //     //2.Load hidden transaction to transaction scope
    //     //
    //     let negativeDataObject = {};
    //     try {
    //     } catch {}
    //   });
    console.log("TransactionScopeTester:: Finished mocha section");
  });
  //runs the following tests:
  //Test getLine() before load -> should return undefined - done
  //Test getLines() before load -> should return empty array - done
  //Test getLine() after load -> should return search scope item - done
  //Test getLines() after load -> should return scoped items - done
  console.log(
    "TransactionScopeTester:: Finished TransactionScope automation test"
  );
  const testResult = await run();
  res.json(testResult);
});
//===========================Get JWT from CPISide Endpoint========================================
router.get("/JWT", async (req, res, next) => {
  try {
    const JWT = await pepperi.auth.getAccessToken();
    console.log(`JWTTester:: JWT output: ${JWT}`);
    res.json({
      JWT: JWT,
      err: "None",
    });
  } catch (err) {
    console.log(
      `JWTTester:: Failed Getting JWT from CPISide with the following error: ${err}`
    );
    res.json({
      JWT: "None",
      err: err,
    });
  }
});
//===========================UIObject.Create Test Endpoint================================================
router.get("/UIObjectCreate", async (req, res, next) => {
  console.log("Inside uiObject.Create endpoint");
  const testResult = await createUIObjectTest();
  res.json(testResult);
});
//===========================Positive dataObject CRUD endpoint============================================
router.get("/dataObjectCrud", async (req, res, next) => {
  console.log("Inside dataObjectCrud endpoint");
  const testResult = await dataObjectCrud();
  res.json(testResult);
});
//===========================Negative dataObject CRUD endpoint============================================
router.get("/dataObjectNegativeCrud", async (req, res, next) => {
  console.log("Inside dataObjectNegativeCrud endpoint");
  const testResult = await dataObjectNegativeCrud();
  res.json(testResult);
});
//===========================Positive UIObject 1 CRUD endpoint============================================
router.get("/firstUIObjectCrud", async (req, res, next) => {
  console.log("Inside firstUIObjectCrud endpoint");
  const testResult = await firstUIObjectCrud();
  res.json(testResult);
});
//===========================Positive UIObject 2 CRUD endpoint============================================
router.get("/secondUIObjectCrud", async (req, res, next) => {
  console.log("Inside secondUIObjectCrud endpoint");
  const testResult = await secondUIObjectCrud();
  res.json(testResult);
});
//===================runScript cpi-side endpoint==========================================================
router.get("/runScript", async (req, res, next) => {
  console.log("Inside runScript endpoint on automation addon");
  const scriptKey = req.body.Key;
  const scriptData = req.body.Data;

  const scriptRun = await runScript(scriptKey, scriptData);
  res.json(scriptRun);
});
//=========================get Synced data from udc - if the data is here the sync test should be good==========================================
//Sync endpoint to GET specific document from UDC
router.use("/getDataFromSync", async (req, res, next) => {
  const tableName = req.body.tableName;
  const key = req.body.Key;
  let filterObj = {
    table: tableName,
    key: key
  } as UDCGetParams;
  const response = await pepperi.api.userDefinedCollections.get(filterObj);
  res.json(response);
});
//Sync endpoint to GetList with indexed field
router.use("/getListFromSync", async (req, res, next) => {
  const tableName = req.body.tableName;
  const index = req.body.Index;
  let filterObj = {
    table: tableName,
    index: index
  } as UDCGetListParams;
  const response = await pepperi.api.userDefinedCollections.getList(filterObj);
  res.json(response);
});
//Sync endpoint to GET data from adal after sync
router.use("/getDataFromADAL", async (req, res, next) => {
  const tableName = req.body.tableName;
  const key = req.body.Key;

  const adalGet = await pepperi.api.adal.get({
    addon: addonUUID,
    key: key,
    table: tableName
  });

  res.json(adalGet);
});
//Sync endpoint to GET list data from ADAL
router.use("/getListFromADAL", async (req, res, next) => {
  const tableName = req.body.tableName;

  const list = await pepperi.api.adal.getList({ table: tableName, addon: addonUUID });

  res.json(list);
});
