import {
  FETCH_WORDS,
  SET_NEW_WORD
} from '../action_types/WordsActionTypes';
import WordsActionCreators from '../action_creators/WordsActionCreators';
import endpoints from '../utils/http/endpoints';
import http from '../utils/http';

/**
 * Fetches words and their definitions for the Wordnik API and
 * stores them in cache
 */
const fetchWords = () => {
  return (dispatch) => {
    dispatch(WordsActionCreators.fetching());

    http.get(endpoints.wordnik.randomWords)
      .then((response) => {
        const words = Object.keys(response).map((key) => response[key].word);

        Promise.all(words.map((word) => {
          return http.get(endpoints.wordnik.word.definitions(word));
        }))
          .then((wordDefinitions) => {
            const [word, ...restWords] = wordDefinitions
              .map((definitions, i) => {
                return {
                  definitions: [...new Set(Object.keys(definitions).map((key) => definitions[key].text))],
                  word: words[i]
                };
              })
              .filter(({definitions}) => definitions.length > 1);
            
            // We add a date timestamp to the newly set word so we know when
            // to replace it
            const currentWord = Object.assign({}, word, {
              createdAt: new Date().toISOString()
            });

            chrome.storage.sync.set({currentWord}, () => {
              chrome.storage.sync.set({words: restWords}, () => {
                dispatch(WordsActionCreators.fetchSuccess(currentWord));
              });
            });
          })
          .catch((err) => {
            dispatch(WordsActionCreators.fetchError(err));
          });

      })
      .catch((err) => {
        dispatch(WordsActionCreators.fetchError(err));
      });
  };
};

/**
 * Sets a new `currentWord` from the list of cached words, and also
 * updates the list of cached words
 * @param {Object} options - The action originally fired
 * @param {Object} options.payload - The action payload
 * @param {Array} options.payload.words - The array of words from cache
 */
const setNewWord = ({payload: {words}}) => {
  return (dispatch) => {
    dispatch(WordsActionCreators.setNewWordPending());

    // Gets a random word from the cached words
    const randIndex = Math.floor(Math.random() * words.length);
    const word = words[randIndex];
    const restCachedWords = [...words.slice(0, randIndex), ...words.slice(randIndex + 1, words.length)];

    chrome.storage.sync.set({currentWord: word}, () => {
      chrome.storage.sync.set({words: restCachedWords}, () => {
        dispatch(WordsActionCreators.setNewWordSuccess(word));
      });
    });
  };
};

export default {
  [FETCH_WORDS]: fetchWords,
  [SET_NEW_WORD]: setNewWord
};