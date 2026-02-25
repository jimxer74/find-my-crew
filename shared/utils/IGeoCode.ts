/**
 * A Geocode element
 */
export interface IGeoCode {
    type: string;
    coordinates: number[];
};

export const toGeocode = (lat: number | undefined, lng: number | undefined): IGeoCode => {
    return {type: 'Point',
        coordinates: [lng || 0 , lat || 0 ] };
}

/**
 * A geographical location
 */
 export interface ILocation {

    place: string;
    geocode: IGeoCode;
};