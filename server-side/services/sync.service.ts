import { GridDataViewField, PapiClient } from "@pepperi-addons/papi-sdk";
import { Client } from "@pepperi-addons/debug-server";
import fetch from "node-fetch";
import {
  AddonDataScheme,
  SchemeField,
  GridDataView,
  DocumentKeyType,
  AddonData,
} from "@pepperi-addons/papi-sdk";
//api design:
//https://apidesign.pepperi.com/sync/pull-data

export interface SyncSettings {
  Key: string;
  SYNC_DATA_SIZE_LIMITATION: number;
  SYNC_TIME_LIMITATION: number;
  USER_DEFINED_COLLECTIONS: string;
  USER_DEFINED_COLLECTIONS_INDEX_FIELD: string;
}

export interface CollectionField extends SchemeField {
  Mandatory: boolean;
  OptionalValues?: string[];
  Description: string;
}
export interface DocumentKey {
  Type: DocumentKeyType;
  Fields?: string[];
  Delimiter?: string;
}
export interface Collection extends AddonDataScheme {
  Hidden?: boolean;
  CreationDateTime?: string;
  ModificationDateTime?: string;
  Name: string;
  Description?: string;
  DocumentKey?: DocumentKey;
  ListView?: GridDataView;
  Fields?: {
    [key: string]: CollectionField;
  };
}

class SyncService {
  papiClient: PapiClient;

  constructor(private client: Client) {
    this.papiClient = new PapiClient({
      baseURL: client.BaseURL,
      token: client.OAuthAccessToken,
      addonSecretKey: client.AddonSecretKey,
      addonUUID: client.AddonUUID,
    });
  }

  async pullData(syncObject: any) {
    const url = `/addons/data/pull`;
    const res = await this.papiClient.post(url, syncObject);
    return res;
  }

  async getSyncFromAuditLog(url: string) {
    let syncDataFromFile = await (
      await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
    ).json();

    return syncDataFromFile;
  }

  async sleep(ms: number) {
    console.debug(`Sleep: ${ms} milliseconds`, "color: #f7df1e");
    await new Promise((f) => setTimeout(f, ms));
  }

  async getAuditLogResultObjectIfValid(
    uri: string,
    loopsAmount = 30
  ): Promise<any> {
    let auditLogResponse;
    do {
      auditLogResponse = await this.papiClient.get(uri);
      auditLogResponse =
        auditLogResponse === null
          ? auditLogResponse
          : auditLogResponse[0] === undefined
          ? auditLogResponse
          : auditLogResponse[0];
      //This case is used when AuditLog was not created at all (This can happen and it is valid)
      if (auditLogResponse === null) {
        this.sleep(4000);
        console.log("Audit Log was not found, waiting...");
        loopsAmount--;
      }
      //This case will only retry the get call again as many times as the "loopsAmount"
      else if (auditLogResponse.Status.ID == "2") {
        this.sleep(2000);
        console.log(
          "In_Progres: Status ID is 2, Retry " + loopsAmount + " Times."
        );
        loopsAmount--;
      }
    } while (
      (auditLogResponse === null || auditLogResponse.Status.ID == "2") &&
      loopsAmount > 0
    );

    //Check Date and Time
    try {
      if (
        !auditLogResponse.CreationDateTime.includes(
          new Date().toISOString().split("T")[0] && "Z"
        ) ||
        !auditLogResponse.ModificationDateTime.includes(
          new Date().toISOString().split("T")[0] && "Z"
        )
      ) {
        throw new Error("Error in Date and Time in Audit Log API Response");
      }
    } catch (error) {
      if (error instanceof Error) {
        error.stack =
          "Date and Time in Audit Log API Response:\n" + error.stack;
      }
      throw error;
    }
    return auditLogResponse;
  }

  async postUDCScheme(obj: Collection) {
    let res;
    // = await this.papiClient.userDefinedCollections.schemes.upsert(
    //   obj
    // );
    return res;
  }

  async upsertDocument(collectionName: string, obj: AddonData) {
    const res = await this.papiClient.userDefinedCollections
      .documents(collectionName)
      .upsert(obj);
    return res;
  }

  async setSyncOptions(syncOptions: SyncSettings) {
    const res = await this.papiClient.post(
      `/addons/api/5122dc6d-745b-4f46-bb8e-bd25225d350a/api/sync_variables`,
      syncOptions
    );
    return res;
  }

  async generateUDCScheme(
    numberOfFields: number,
    schemeObj?: any
  ): Promise<Collection> {
    let fields = {} as any;
    let fieldsForListView = [] as GridDataViewField[];
    for (let i = 1; i < numberOfFields; i++) {
      fields[`testField${i}`] = {
        Description: `descriptionForTestField${i}`,
        Mandatory: i == 1 ? true : false,
        Type: "String",
        OptionalValues: [],
        Items: { Type: "String" },
      } as CollectionField;
      
      fieldsForListView[i] = {
        FieldID: `testField${i}`,
        Type: "TextBox",
        Title: `testField${i}`,
        Mandatory: i == 1 ? true : false,
        ReadOnly: true,
      } as GridDataViewField;
    }
    const scheme: Collection = {
      Name: schemeObj.Name
        ? schemeObj.Name
        : `RandomScheme${Math.floor(Math.random() * 10000)}`,
      Description: schemeObj.Description
        ? schemeObj.Description
        : `RandomScheme${Math.floor(Math.random() * 10000)}`,
      Fields: fields,
      ListView: {
        Columns: [
          {
            Width: 10,
          },
          {
            Width: 10,
          },
        ],
        Fields: fieldsForListView,
        Type: "Grid", //should always be Grid
      },
    };

    return scheme;
  }

  async generateDocument(numberOfFields: number) {
    const document = {};
    for (let i = 1; i < numberOfFields; i++) {
      if (i == 1) {
        document[`testField${i}`] = `testKey${Math.floor(
          Math.random() * 1000000
        )}`;
      } else {
        document[`testField${i}`] = `testData${i}`;
      }
    }
    return document as AddonData;
  }

  async generateIndexedDocument(numberOfFields: number) {
    const document = {};
    for (let i = 1; i < numberOfFields; i++) {
      if (i == 2) {
        document[`testField${i}`] = `Indexed${Math.floor(
          Math.random() * 1000000
        )}`;
      } else {
        document[`testField${i}`] = `testData${i}`;
      }
    }
    return document as AddonData;
  }

  async dropUDCTable(tableName: string) {} // not implemented yet on UDC

  async getDataFromCPISide(
    webAPIBaseURL: string,
    accessToken: string,
    tableName: string,
    key: string
  ) {
    let body = { Key: key, tableName: tableName };
    let URL = `${webAPIBaseURL}/Service1.svc/v1/Addons/Api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/addon-cpi/getDataFromSync`;
    const res = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "text/plain",
        },
      })
    ).json();
    //"application/json", replace once DI-18306 is fixed -->change "text/plain" once fixed

    return res;
  }

  async getListFromCPISide(
    webAPIBaseURL: string,
    accessToken: string,
    tableName: string,
    index: string
  ) {
    let body = { Index: index, tableName: tableName };
    let URL = `${webAPIBaseURL}/Service1.svc/v1/Addons/Api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/addon-cpi/getListFromSync`;
    const res = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "text/plain",
        },
      })
    ).json();
    //"application/json", replace once DI-18306 is fixed -->change "text/plain" once fixed

    return res;
  }

  async getADALFromCPISide(
    webAPIBaseURL: string,
    accessToken: string,
    tableName: string,
    key: string
  ) {
    let body = { Key: key, tableName: tableName };
    let URL = `${webAPIBaseURL}/Service1.svc/v1/Addons/Api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/addon-cpi/getDataFromADAL`;
    const res = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "text/plain",
        },
      })
    ).json();
    //"application/json", replace once DI-18306 is fixed -->change "text/plain" once fixed

    return res;
  }

  async getADALListFromCPISide(
    webAPIBaseURL: string,
    accessToken: string,
    tableName: string
  ) {
    let body = { tableName: tableName };
    let URL = `${webAPIBaseURL}/Service1.svc/v1/Addons/Api/2b39d63e-0982-4ada-8cbb-737b03b9ee58/addon-cpi/getListFromADAL`;
    const res = await (
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          PepperiSessionToken: accessToken,
          "Content-Type": "text/plain",
        },
      })
    ).json();
    //"application/json", replace once DI-18306 is fixed -->change "text/plain" once fixed

    return res;
  }

  async generateADALObj() {
    const object = await this.generateDocument(11);
    object.Key = object.testField1;

    return object;
  }

  async purgeADALTable(tableName: string) {
    const purge = await this.papiClient.post(
      `/addons/data/schemes/${tableName}/purge`
    );
    return purge;
  }

  async createADALScheme(
    tableName: string,
    type: "data" | "meta_data" | "cpi_meta_data"
  ) {
    const syncScheme = await this.papiClient.addons.data.schemes.post({
      Name: tableName,
      Type: type,
    });

    return syncScheme;
  }

  async roughSizeOfObject(object) {
    var objectList: any[] = [];
    var stack = [object];
    var bytes = 0;

    while (stack.length) {
      var value = stack.pop();

      if (typeof value === "boolean") {
        bytes += 4;
      } else if (typeof value === "string") {
        bytes += value.length * 2;
      } else if (typeof value === "number") {
        bytes += 8;
      } else if (
        typeof value === "object" &&
        objectList.indexOf(value) === -1
      ) {
        objectList.push(value);

        for (var i in value) {
          stack.push(value[i]);
        }
      }
    }
    return bytes;
  }

  async getUDCScheme() {
    const scheme = await this.papiClient.userDefinedCollections.schemes.find({
      where: `Hidden=false`,
    });
    return scheme;
  }

  async validateResourceData(ResourcesData: any[],resourceName: string) {
   let testObjects:any[] = [];

   for(const data of ResourcesData) {
    if(data.Schema.Name === resourceName) {
      testObjects = data.Objects;
    }
   }

   return testObjects;
  }

  async validateResourceScheme(ResourcesData: any[],resourceName: string) {
    let testScheme:any = {};

    for(const data of ResourcesData) {
     if(data.Schema.Name === resourceName) {
       testScheme = data.Schema;
     }
    }

    return testScheme;
  }
}

export default SyncService;
