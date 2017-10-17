'use strict';

/*
     config is passed through to fetch, so could include things like:
     {
         method: 'get',
         credentials: 'same-origin'
    }
*/
const gettyULAN = 'ulan';
const gettyTGN = 'tgn';

function fetchWithTimeout(url, config = {}, timeout = 8000) {

        return new Promise((resolve, reject) => {
            // the reject on the promise in the timeout callback won't have any effect, *unless*
            // the timeout is triggered before the fetch resolves, in which case the setTimeout rejects
            // the whole outer Promise, and the promise from the fetch is dropped entirely.
            setTimeout(() => reject(new Error('Call to Getty timed out')), timeout);
            fetch(url, config).then(resolve, reject);
        }).then(
            response=>{
                // check for ok status
                if (response.ok) {
                    return response.json()
                }
                // if status not ok, through an error
                throw new Error(`Something wrong with the call to Getty, possibly a problem with the network or the server. HTTP error: ${response.status}`);
            }/*,
            // instead of handling and rethrowing the error here, we just let it bubble through
            error => {
            // we could instead handle a reject from either of the fetch or setTimeout promises,
            // whichever first rejects, do some loggingor something, and then throw a new rejection.
                console.log(error)
                return Promise.reject(new Error(`some error jjk: ${error}`))
            }*/
        )
}

// note that this method is exposed on the npm module to simplify testing,
// i.e., to allow intercepting the HTTP call during testing, using sinon or similar.
function getEntitySourceURI(queryString, gettyVocab) {

        return `http://vocab.getty.edu/sparql.json?query=` + encodeURIComponent(`select ?Subject ?Term ?Parents ?Descr ?ScopeNote ?Type (coalesce(?Type1,?Type2) as ?ExtraType) {
  ?Subject luc:term "${queryString}"; a ?typ; skos:inScheme ${gettyVocab}:.
  ?typ rdfs:subClassOf gvp:Subject; rdfs:label ?Type.
  filter (?typ != gvp:Subject)
  optional {?Subject gvp:placeTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type1]]}
  optional {?Subject gvp:agentTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type2]]}
  optional {?Subject gvp:prefLabelGVP [xl:literalForm ?Term]}
  optional {?Subject gvp:parentStringAbbrev ?Parents}
  optional {?Subject foaf:focus/gvp:biographyPreferred/schema:description ?Descr}
  optional {?Subject skos:scopeNote [dct:language gvp_lang:en; rdf:value ?ScopeNote]}}
  LIMIT 5`);
}

function getPersonLookupURI(queryString) {
    return getEntitySourceURI(queryString, gettyULAN)
}

function getPlaceLookupURI(queryString) {
    return getEntitySourceURI(queryString, gettyTGN)
}

async function callGetty(url, queryString, gettyVocab) {

        let parsedJSON = await fetchWithTimeout(url);
        console.log(parsedJSON)
        return parsedJSON.results.bindings.map(
            ({
                 Subject: {value: uri},
                 Term: {value: name},
                 Descr: {value: description = 'No description available'} = "No description available"
             }) => {
                return {nameType: gettyVocab, id: uri, uri, name, repository: 'getty', originalQueryString: queryString, description}
            })
}

/*return parsedJSON.results.bindings.map(
    (result) => {
        let uri = result.Subject.value;
        let name = result.Term.value;
        let description = result.Descr?
            result.Descr.value:
            "No description available"
        return {nameType: gettyVocab, id: uri, uri, name, repository: 'getty', originalQueryString: queryString, description}
    })*/
async function findPerson(queryString) {
    return callGetty(getPersonLookupURI(queryString), queryString, gettyULAN)
}

async function findPlace(queryString) {
    return callGetty(getPlaceLookupURI(queryString), queryString, gettyTGN)
}

module.exports = {
    findPerson: findPerson,
    findPlace: findPlace,
    getPersonLookupURI: getPersonLookupURI,
    getPlaceLookupURI: getPlaceLookupURI,

    fetchWithTimeout: fetchWithTimeout
}