/**
 * JSDoc typedefs shared by client and server (JSDoc only — no TypeScript).
 */

/**
 * @typedef {Object} ApiSuccess<T>
 * @property {true} success
 * @property {T} data
 */

/**
 * @typedef {Object} ApiErrorBody
 * @property {false} success
 * @property {{ code: string, message: string, fields?: Record<string,string[]> }} error
 */

/**
 * @typedef {'new'|'learning'|'review'|'relearning'} SrsState
 */

/**
 * @typedef {Object} SrsInput
 * @property {SrsState} state
 * @property {number} interval        days (or minutes in learning — see srs.js)
 * @property {number} easeFactor      1.30–3.00
 * @property {number} repetitions
 * @property {number} lapses
 * @property {number} lastReviewedAt  epoch ms
 */

/**
 * @typedef {0|1|2|3} Rating 0=Again, 1=Hard, 2=Good, 3=Easy
 */

/**
 * @typedef {Object} SrsResult
 * @property {SrsState} state
 * @property {number} interval
 * @property {number} easeFactor
 * @property {number} repetitions
 * @property {number} lapses
 * @property {number} dueDate epoch ms
 */

/**
 * @typedef {Object} KanjiDocument
 * @property {string} character
 * @property {string} unicode         lowercase hex, no prefix
 * @property {string[]} meanings
 * @property {string[]} readingsOn
 * @property {string[]} readingsKun
 * @property {string[]} nameReadings
 * @property {5|4|3|2|1|null} jlptLevel
 * @property {number|null} grade
 * @property {number} strokeCount
 * @property {string} radical
 * @property {string[]} radicals
 * @property {string[]} components
 * @property {string|null} strokeOrderSvg
 * @property {boolean} hasStrokeOrder
 * @property {number|null} frequencyRank
 * @property {boolean} isJoyo
 * @property {boolean} isJinmeiyo
 * @property {boolean} isKyouiku
 * @property {{word:string,reading:string,meaning:string,jlptLevel?:number,common:boolean}[]} exampleWords
 * @property {{japanese:string,english:string,audioUrl?:string}[]} exampleSentences
 * @property {string|null} mnemonic
 */

export {};
