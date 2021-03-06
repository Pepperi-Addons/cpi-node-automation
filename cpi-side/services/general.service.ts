import "@pepperi-addons/cpi-node";
//interface for navigate client action
export interface NavigationOptions {
  url: string;
  history?: "None" | "ClearTo" | "ClearAll";
}

export interface UDCGetListParams {
  table: string;
  index?: string;
}

export interface UDCGetParams {
  table: string;
  key: string;
}

export default class GeneralService {
  constructor() {}

  /**formats date to ISO */
  async dateFormatter(date: string, time?: boolean, removeChar?: boolean) {
    if (time) {
      let concatedDateTime = date.split(".");
      if (removeChar) {
        concatedDateTime = date.split("Z");
      }
      return concatedDateTime[0].toString();
    }
    const concatedDate = date.split("T");
    return concatedDate[0].toString();
  }
  /**randGenerator for numeric fields */
  async randGenerator(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
