const BASE_URL = 'https://vocab.getty.edu';
const GETTY_ULAN = 'ulan';
const GETTY_TGN = 'tgn';

const findPerson = (query) => callGetty(getPersonLookupURI(query), query, GETTY_ULAN);
const findPlace = (query) => callGetty(getPlaceLookupURI(query), query, GETTY_TGN);

const getPersonLookupURI = (query) => getEntitySourceURI(query, GETTY_ULAN);
const getPlaceLookupURI = (query) => getEntitySourceURI(query, GETTY_TGN);

/**
 * It takes a url and a query, and returns an array of objects with the results from the Getty API
 * @param url - the url to call
 * @param query - the query string that the user typed in the search box
 * @param gettyVocab - the vocabulary to search in, e.g. 'ulan'
 * @returns An array of objects with the following properties:
 *   nameType: gettyVocab,
 *   id: uri,
 *   uri,
 *   uriForDisplay: BASE_URL,
 *   name,
 *   repository: 'getty',
 *   originalQueryString: query,
 *   description,
 */
const callGetty = async (url, query, gettyVocab) => {
  const response = await fetchWithTimeout(url).catch((error) => {
    return error;
  });

  //if status not ok, through an error
  if (!response.ok)
    throw new Error(
      `Something wrong with the call to Getty, possibly a problem with the network or the server. HTTP error: ${response.status}`
    );

  const responseJson = await response.json();

  const mapResponse = responseJson.results.bindings.map(
    ({
      Subject: { value: uri },
      Term: { value: name },
      Descr: { value: description = 'No description available' } = 'No description available',
    }) => {
      return {
        nameType: gettyVocab,
        id: uri,
        uri,
        uriForDisplay: BASE_URL,
        name,
        repository: 'getty',
        originalQueryString: query,
        description,
      };
    }
  );

  return mapResponse;
};

/**
 * If the fetch takes longer than <time> milliseconds, reject the promise with the message 'Call to Getty timed out'.
 * @param url - the url to fetch
 * @param [config] - an object containing the configuration for the request.
 * @param [time=30_000] - the time in milliseconds to wait before rejecting the promise
 * @returns A function that takes in a url, config, and time.
 */
const fetchWithTimeout = (url, config = {}, time = 30000) => {
  const timeout = new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject('Call to Getty timed out');
    }, time);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([fetch(url, config), timeout]);
};

/**
 * It takes a query string and a vocabulary ID, and returns a URL that will return a JSON object
 * containing the results of a SPARQL query
 * @param query - the query string
 * @param gettyVocab - The Getty Vocabulary Program's URI.
 * @returns The query returns the following:
 */
const getEntitySourceURI = (query, gettyVocab) => {
  const encodedQuery =
    encodeURIComponent(`select ?Subject ?Term ?Parents ?Descr ?ScopeNote ?Type (coalesce(?Type1,?Type2) as ?ExtraType) {
    ?Subject luc:term "${query}"; a ?typ; skos:inScheme ${gettyVocab}:.
    ?typ rdfs:subClassOf gvp:Subject; rdfs:label ?Type.
    filter (?typ != gvp:Subject)
    optional {?Subject gvp:placeTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type1]]}
    optional {?Subject gvp:agentTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type2]]}
    optional {?Subject gvp:prefLabelGVP [xl:literalForm ?Term]}
    optional {?Subject gvp:parentStringAbbrev ?Parents}
    optional {?Subject foaf:focus/gvp:biographyPreferred/schema:description ?Descr}
    optional {?Subject skos:scopeNote [dct:language gvp_lang:en; rdf:value ?ScopeNote]}}
    LIMIT 5`);

  return `${BASE_URL}/sparql.json?query=${encodedQuery}`;
};

export default {
  findPerson,
  findPlace,
  getPersonLookupURI,
  getPlaceLookupURI,
};
