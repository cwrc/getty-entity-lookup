'use strict';

import fetchMock from 'fetch-mock';
import getty from '../src/index.js';

const emptyResultFixture = JSON.stringify(require('./httpResponseMocks/noResults.json'));
const resultsFixture = JSON.stringify(require('./httpResponseMocks/results.json'));
const noDescResultsFixture = JSON.stringify(require('./httpResponseMocks/resultsWitoutDescription.json'));

const queryString = 'jones';
const queryStringWithNoResults = 'ldfjk';
const queryStringForTimeout = 'chartrand';
const queryStringForError = 'cuff';
const queryStringForMissingDescriptionInGettyResult = 'blash';
const expectedResultLength = 5;

jest.useFakeTimers();

// setup server mocks for each type of call
[
    { uriBuilderFn: 'getPersonLookupURI', testFixture: resultsFixture },
    { uriBuilderFn: 'getPlaceLookupURI', testFixture: resultsFixture }
].forEach(entityLookup => {

    const uriBuilderFn = getty[entityLookup.uriBuilderFn];

    fetchMock.get(uriBuilderFn(queryString), entityLookup.testFixture);
    fetchMock.get(uriBuilderFn(queryStringWithNoResults), emptyResultFixture);
    fetchMock.get(uriBuilderFn(queryStringForTimeout), () => {
        setTimeout(Promise.resolve, 8100);
    });
    fetchMock.get(uriBuilderFn(queryStringForError), 500);
    fetchMock.get(uriBuilderFn(queryStringForMissingDescriptionInGettyResult), noDescResultsFixture)
})

// from https://stackoverflow.com/a/35047888
const doObjectsHaveSameKeys = (...objects) => {
    const allKeys = objects.reduce((keys, object) => keys.concat(Object.keys(object)), []);
    const union = new Set(allKeys);
    return objects.every(object => union.size === Object.keys(object).length);
}

test('lookup builders', () => {
    expect.assertions(2);
    ['getPersonLookupURI', 'getPlaceLookupURI'].forEach(uriBuilderMethod => {
        expect(getty[uriBuilderMethod](queryString).includes(queryString)).toBe(true);
    });
});

['findPerson', 'findPlace'].forEach((nameOfLookupFn) => {
    test(nameOfLookupFn, async () => {
        expect.assertions(12);

        const results = await getty[nameOfLookupFn](queryString);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(expectedResultLength);
        results.forEach(singleResult => {
            expect(doObjectsHaveSameKeys(singleResult, {
                nameType: '',
                id: '',
                uri: '',
                uriForDisplay: '',
                name: '',
                repository: '',
                originalQueryString: '',
                description: ''
            })).toBe(true);
            expect(singleResult.originalQueryString).toBe(queryString);
        })
    })

    test(`${nameOfLookupFn} - no Description`, async () => {
        // with a result from getty with no Description
        expect.assertions(3);

        const results = await getty[nameOfLookupFn](queryStringForMissingDescriptionInGettyResult);
        expect(Array.isArray(results)).toBe(true);
        expect(doObjectsHaveSameKeys(results[0], {
            nameType: '',
            id: '',
            uri: '',
            uriForDisplay: '',
            name: '',
            repository: '',
            originalQueryString: '',
            description: ''
        })).toBe(true);
        expect(results[0].description).toBe('No description available');
    })

    test(`${nameOfLookupFn} - no results`, async () => {
         // with no results
        expect.assertions(2);

        const results = await await getty[nameOfLookupFn](queryStringWithNoResults);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
    })

    test(`${nameOfLookupFn} - server error`, async () => {
        // with a server error
        expect.assertions(2);
     
        let shouldBeNullResult = false;
        shouldBeNullResult = await getty[nameOfLookupFn](queryStringForError).catch( () => {
            // an http error should reject the promise
            expect(true).toBe(true);
            return false;
        })
        // a falsey result should be returned
        expect(shouldBeNullResult).toBeFalsy();
    })

    test(`${nameOfLookupFn} - times out`, async () => {
         // when query times out
         expect.assertions(1);
         await getty[nameOfLookupFn](queryStringForTimeout)
             .catch( () => {
                 expect(true).toBe(true);
             })
    })
})
