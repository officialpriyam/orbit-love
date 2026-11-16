export interface LocationSettings {
  country_enabled: boolean;
  outside_country_enabled: boolean;
  city_enabled: boolean;
}
export const defaultLocationSettings: LocationSettings = {
  country_enabled: false,
  outside_country_enabled: false,
  city_enabled: true,
};
