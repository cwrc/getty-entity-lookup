const GETTY_ULAN = 'ulan';
const GETTY_TGN = 'tgn';

const findPerson = (queryString) => callGetty(getPersonLookupURI(queryString), queryString, GETTY_ULAN);
const findPlace = (queryString) => callGetty(getPlaceLookupURI(queryString), queryString, GETTY_TGN);

const getPersonLookupURI = (queryString) => getEntitySourceURI(queryString, GETTY_ULAN);
const getPlaceLookupURI = (queryString) => getEntitySourceURI(queryString, GETTY_TGN);

const callGetty = async (url, queryString, gettyVocab) => {
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
        uriForDisplay: uri.replace('http://vocab.getty.edu', 'https://getty.lookup.services.cwrc.ca'),
        name,
        repository: 'getty',
        originalQueryString: queryString,
        description,
      };
    }
  );

  return mapResponse;
};

/*
     config is passed through to fetch, so could include things like:
     {
         method: 'get',
         credentials: 'same-origin'
    }
*/

const fetchWithTimeout = (url, config = {}, time = 30000) => {
  /*
        the reject on the promise in the timeout callback won't have any effect, *unless*
        the timeout is triggered before the fetch resolves, in which case the setTimeout rejects
        the whole outer Promise, and the promise from the fetch is dropped entirely.
    */

  // Create a promise that rejects in <time> milliseconds
  const timeout = new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject('Call to Getty timed out');
    }, time);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([fetch(url, config), timeout]);
};

// note that this method is exposed on the npm module to simplify testing,
// i.e., to allow intercepting the HTTP call during testing, using sinon or similar.
const getEntitySourceURI = (queryString, gettyVocab) => {
  // Calls a cwrc proxy (https://lookup.services.cwrc.ca/getty), so that we can make https calls from the browser.
  // The proxy in turn then calls http://vocab.getty.edu
  // The getty lookup doesn't seem to have an https endpoint
  return (
    'https://lookup.services.cwrc.ca/getty/sparql.json?query=' +
    encodeURIComponent(`select ?Subject ?Term ?Parents ?Descr ?ScopeNote ?Type (coalesce(?Type1,?Type2) as ?ExtraType) {
        ?Subject luc:term "${queryString}"; a ?typ; skos:inScheme ${gettyVocab}:.
        ?typ rdfs:subClassOf gvp:Subject; rdfs:label ?Type.
        filter (?typ != gvp:Subject)
        optional {?Subject gvp:placeTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type1]]}
        optional {?Subject gvp:agentTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type2]]}
        optional {?Subject gvp:prefLabelGVP [xl:literalForm ?Term]}
        optional {?Subject gvp:parentStringAbbrev ?Parents}
        optional {?Subject foaf:focus/gvp:biographyPreferred/schema:description ?Descr}
        optional {?Subject skos:scopeNote [dct:language gvp_lang:en; rdf:value ?ScopeNote]}}
        LIMIT 5`)
  );
};

export default {
  findPerson,
  findPlace,
  getPersonLookupURI,
  getPlaceLookupURI,
};
