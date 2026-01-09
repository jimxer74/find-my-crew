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

export const getLat = (geocode: IGeoCode): number => {
    return geocode.coordinates[1];
}

export const getLng = (geocode: IGeoCode): number => {
    return geocode.coordinates[0];
}

/**
 * A geographical location
 */
 export interface ILocation {

    place: string;
    geocode: IGeoCode;
};