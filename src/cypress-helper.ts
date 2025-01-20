import { addMatchImageSnapshotCommand } from "@simonsmith/cypress-image-snapshot/command.js";
import type { CypressImageSnapshotOptions } from "@simonsmith/cypress-image-snapshot/types";
import type axe from "axe-core";
import chaiSubset from "chai-subset";
import type { Options as AxeOptions } from "cypress-axe";
import "cypress-real-events";
import "cypress-wait-if-happens";
import "cypress-wait-until";
import { StringMatcher } from "cypress/types/net-stubbing";
import type { SinonStub } from "cypress/types/sinon";
import {
  StubbedInstance as GenericStubbedInstance,
  StubbedInstanceCreator
} from "ts-stubber";

export type SnapshotOptions = {
  index?: number;
  dataTestID?: string;
} & CypressImageSnapshotOptions;

export type A11yOptions = {
  /**
   * Allows you to define a callback that receives the violations for custom side-effects, such as adding custom output to the terminal.
   */
  violationCallback?: ((violations: axe.Result[]) => void) | undefined;
  /**
   * Disables assertions based on violations and only logs violations to the console output.
   */
  skipFailures?: boolean;
} & AxeOptions;

export type StubbedInstance<T> = GenericStubbedInstance<T, SinonStub>;
/**
 * Sinon matcher for stubs/spy comparison
 * @example
 * ```ts
 *   // partial match of spy function params called with
 *   let { given, when, get } = new CypressHelper();
 *   it("should partially match spy params", () => {
 *       const obj = {
 *         func: (param: Object) => {}
 *       };
 *       given.spyOnObject(obj, "func");
 *       obj.func({ shelly: "go", inner: { attr: "value" } });
 *       then(get.spyFromFunction(obj.func)).shouldHaveBeenCalledWithMatch(
 *         match({ inner: { attr: "value" } })
 *       );
 *     });
 * ```
 * For more information see [Sinon.match documentation](https://sinonjs.org/releases/latest/matchers/)
 */
export const match = Cypress.sinon.match;

export class CypressHelperOptions {
  /**
   * default data attribute for elements selection
   */
  defaultDataAttribute?: string = "data-cy";
  /**
   * slot dataTestID suffix (only relevant when handleSlotShadowDOM  is set to true)
   */
  shadowSlotSuffix?: string = "slot";
  /**
   * when set to true, cypress helper will automatically find the assigned dom element of elements with dataTestID
   * with `defaultShadowSlotSuffix` suffix
   */
  handleSlotShadowDOM?: boolean = true;
  /**
   * when set to true, waits until elements are loaded before returning them
   */
  waitForElementsToLoad?: boolean = true;

  /**
   * when set to true, injects Axe (A11y test tool) before all tests
   */
  injectA11yChecker?: boolean = true;
}
/**
 * @class CypressHelper was designed to help you develop cypress tests faster.
 * @classdes CypressHelper exposes the following public properties:
 * @property given - The given property will hold methods which will allow us to set pre-conditions before something takes place.
 * This is a classic place to have methods which will set the inputs which are going to be passed down to our component.
 * @property when - The when property will hold methods of “events” which will take place like render, click, hover, etc.
 * @property get - The get property will hold methods which will give our tests access to the “output” of the component in a “black box” fashion
 */
export class CypressHelper {
  /**
   *
   * @param [options = {
   * defaultDataAttribute : "data-cy" ,
   * shadowSlotSuffix : "slot",
   * handleSlotShadowDOM : true}]
   */
  constructor(private readonly options: CypressHelperOptions = {}) {
    this.options.defaultDataAttribute =
      this.options.defaultDataAttribute || "data-cy";
    this.options.shadowSlotSuffix = this.options.shadowSlotSuffix || "slot";
    this.options.handleSlotShadowDOM = this.options.handleSlotShadowDOM || true;
    addMatchImageSnapshotCommand({
      failureThreshold: 0.2
    });
  }

  /** @private */
  private isGetter = <T>(constructor: sinon.StubbableType<T>, prop: keyof T) =>
    Object.getOwnPropertyDescriptor(constructor.prototype, prop) &&
    !!Object.getOwnPropertyDescriptor(constructor.prototype, prop)!["get"];
  /** @private */
  private isSetter = <T>(constructor: sinon.StubbableType<T>, prop: keyof T) =>
    Object.getOwnPropertyDescriptor(constructor.prototype, prop) &&
    !!Object.getOwnPropertyDescriptor(constructor.prototype, prop)!["set"];
  /** @private */
  private waitUntilLoadBeforeInvocation = <T>(
    checkFunction: () => Cypress.Chainable<T>,
    options?: WaitUntilOptions
  ): Cypress.Chainable<T> => {
    if (this.options.waitForElementsToLoad) {
      this.when.waitUntil(checkFunction, options);
    }
    return checkFunction();
  };
  /** @private */
  private getShadowSlotElement = (
    dataTestID: string,
    index: number | undefined
  ) =>
    this.get.nthBySelector(dataTestID, index).then(slot => {
      const shadowSlot = Cypress.$(slot as JQuery<HTMLSlotElement>).get(0);
      const shadowSlotParent = this.getShadowSlotParent(shadowSlot);
      return cy.wrap(shadowSlotParent ? shadowSlotParent : shadowSlot);
    });
  /** @private */
  private getShadowSlotParent = (shadowSlot: HTMLSlotElement) => {
    let shadowSlotParent;
    try {
      shadowSlotParent = shadowSlot.assignedNodes()[0].parentElement;
    } catch {}
    return shadowSlotParent;
  };
  /** @private */
  private shouldHandleShadowDomSlot = (dataTestID: string) =>
    this.options.handleSlotShadowDOM &&
    dataTestID.endsWith(`-${this.options.shadowSlotSuffix}`);

  beforeAndAfter = () => {
    before(() => {
      chai.use(chaiSubset);
      if (this.options.injectA11yChecker) cy.injectAxe();
    });
    beforeEach(() => {
      cy.on("uncaught:exception", (err, runnable) => {
        console.log(err);
        return false;
      });
    });
  };

  /**
   * @property given - The given property will hold methods which will allow us to set pre-conditions before something takes place.
   * This is a classic place to have methods which will set the inputs which are going to be passed down to our component.
   */
  public given = {
    /**
     * Use interceptAndMockResponse to stub and intercept HTTP requests and responses.
     * @example
     * ```ts
     * // adds token to response header
     * helper.given.interceptAndMockResponse({
     *   url: '** /sysmgmt/2015/bmc/session',
     *   response: {
     *     headers:{
     *        'XSRF-Token': 'token',
     *     },
     *   },
     *   alias: 'login'
     * })
     * ```
     * @example
     * ```ts
     * // mocks response to login request
     * helper.given.interceptAndMockResponse({
     *   method: "POST",
     *   url: "** /login",
     *   alias: "login",
     *   response : {
     *     token: 'token'
     *   }
     * })
     * ```
     *
     * @example
     * ```ts
     * // mocks network error
     * helper.given.interceptAndMockResponse({
     *   method: "POST",
     *   url: "** /avamars",
     *   alias: "avamar",
     *   response : {
     *     forceNetworkError: true
     *   }
     * })
     * ```
     * @example
     * ```ts
     * // mocks missing image
     * helper.given.interceptAndMockResponse({
     *   method: "POST",
     *   url: "** /image.png",
     *   alias: "image",
     *   response: { statusCode: 404 }
     * })
     * ```
     * @example
     * ```ts
     * // using a fixture
     *  helper.given.interceptAndMockResponse({
     *   url: "** /shellygo/whatever**",
     *   response: { fixture: "user.json" },
     *   alias: "whatever"
     * });
     * ```
     */
    interceptAndMockResponse: (options: {
      url: StringMatcher;
      response?: Object;
      alias?: string;
      method?: string;
    }) => {
      const { url, response, alias, method } = options;
      cy.intercept({ url, method: method || "GET" }, response).as(
        alias || "call"
      );
    },
    /** Use intercept() to intercept HTTP requests and responses
     * @example
     * ```ts
     * helper.given.intercept("/streets/sprite.png", "streetSprite");
     * ```
     */
    intercept: (url: StringMatcher, alias: string, method?: string) =>
      this.given.interceptAndMockResponse({ url, alias, method }),

    /**
     * Sets specific environment variable's value
     * @example
     * // Changing an environment variable
     *      * ```ts
     * helper.given.env("password", "changeMe@1");
     * ```
     */
    env: (key: string, value: any) => Cypress.env(key, value),

    /**
     * Load a fixture
     * @param filename
     * @param alias
     * @example
     * ```ts
     * let { given, when, get } = new CypressHelper();
     * it("should get fixture", () => {
     *  given.fixture("user.json", "user");
     *  then(get.fixture("user")).shouldDeepNestedInclude({
     *    name: "Jane Doe",
     *    id: "1234",
     *    nested: {
     *      attr1: "something",
     *      attr2: "the other thing"
     *    }
     *  });
     *});
     * ```
     */
    fixture: (filename: string, alias: string) =>
      cy.fixture(filename).as(alias),

    /**
     * Creates a new object with the given functions as the prototype and stubs all implemented functions.
     *
     * @example
     * ```ts
     * const serviceMock = helper.given.stubbedInstance(Service);
     * ```
     * @example
     * ```ts
     * class Service {
     *  public func1() {...}
     *  public get prop1() {...}
     * }
     * const serviceMock = helper.given.stubbedInstance(Service, {prop1: 3});
     * ```
     * @example
     * ```ts
     * helper.given.stubbedInstance(Router, { events: new Observable() })
     * ```
     * @example
     * ```ts
     * helper.given.stubbedInstance(
     *  PokemonService,
     *  {
     *    pokemonTypes: new BehaviorSubject<NamedAPIResource[]>([]),
     *    pokemons: new BehaviorSubject<BetterPokemon[]>([]),
     *  }
     * )
     * ```
     */
    stubbedInstance: <T>(
      constructor: { new (...args: any[]): T },
      overrides: Partial<T> = {}
    ) => {
      const createStub = (prop: string) =>
        cy.stub().as(constructor.name + "." + prop) as unknown as SinonStub;
      const stubbedInstanceCreator = StubbedInstanceCreator<T, SinonStub>(
        createStub
      );
      return stubbedInstanceCreator.createStubbedInstance(overrides);
    },
    /**
     * Creates a new object with the given functions as the prototype and stubs all functions.
     *
     * @example
     * ```ts
     * const serviceMock = helper.given.stubbedInterface<IService>("IService");
     * ```
     * @example
     * ```ts
     * interface IService {
     *  propertyFunc: (int: number) => number
     *  get prop1() : number
     * }
     * const serviceMock = helper.given.stubbedInterface<IService>("IService", {prop1: 3});
     * ```
     */
    stubbedInterface: <T extends Object>(
      interfaceName: string,
      overrides: Partial<T> = {}
    ) => {
      const createStub = (prop: string) =>
        cy.stub().as(interfaceName + "." + prop) as unknown as SinonStub;
      const stubbedInstanceCreator = StubbedInstanceCreator<T, SinonStub>(
        createStub
      );
      return stubbedInstanceCreator.createStubbedInstance(overrides);
    },
    /**
     * Replace a function, record its usage and control its behavior.
     * @example
     * ```ts
     * given.stub("alias");
     * then(get.spy("alias")).shouldHaveBeenCalled();
     * ```
     */
    stub: (alias?: string) => (alias ? cy.stub().as(alias) : cy.stub()),
    /**
     * Stub an object's method and create an alias for the stub
     * @param obj object containing function to stub
     * @param method function to stub
     * @example
     * ```ts
     * //stubbing a service method
     *  helper.given.stubObjectMethod(serviceMock, "functionName").returns(3);
     *
     * //stubbing setters and getters
     *  helper.given.stubObjectMethod(serviceMock, "count").get(() => 3).set(() => {});
     * ```
     */
    stubObjectMethod: <T>(obj: T, method: keyof T) =>
      cy.stub(obj, method).as(`${String(method)}`),
    /**
     * Returns a new spy function, and creates an alias for the newly created spy
     * @param name - spy name
     */
    spy: (name: string) => cy.spy().as(`${name}Spy`),
    /**
     * Spy on a method and create an alias for the spy
     * @param obj object containing function to spy on
     * @param method function to spy on
     * @example
     * ```ts
     * given.spyOnObject(window, "alert");
     * alert("whatever");
     * then(helper.get.spyFromFunction(window.alert)).shouldHaveBeenCalledWith("whatever");
     * // Or
     * then(helper.get.spy("alert")).shouldHaveBeenCalledTimes(1);
     * ```
     * @example
     * ```ts
     * given.spyOnObject(serviceMock, "functionName");
     * serviceMock.functionName();
     * then(helper.get.spyFromFunction(serviceMock.functionName)).shouldHaveBeenCalledTimes(1);
     * ```
     */
    spyOnObject: <T>(obj: T, method: keyof T) =>
      cy.spy(obj, method).as(`${String(method)}Spy`)
  };

  /**
   * @property when - The when property will hold methods of “events” which will take place like render, click, hover, etc.
   */
  public when = {
    /**
     * Visit a given url
     */
    visit: (url: string) => {
      cy.visit(url);
      cy.injectAxe();
    },
    /**
     * Wait for a number of milliseconds.
     */
    wait: (ms: number) => cy.wait(ms),
    /**
     * Wait for a specific request to complete.
     *  @param alias
     */
    waitForResponse: (alias: string) =>
      cy.wait(`@${alias}`, {
        timeout: Cypress.config("defaultCommandTimeout")
      }),
    /**
     * Wait for multiples requests to complete.
     * @param alias
     */
    waitForResponses: (alias: string, responses: number) =>
      cy.wait(Array(responses).fill(`@${alias}`), {
        timeout: Cypress.config("defaultCommandTimeout")
      }),
    /**
     * Wait for a last request to complete.
     */
    waitForLastCall: (alias: string, timeout: number = 1000) =>
      cy.waitIfHappens({
        alias: `@${alias}`,
        timeout,
        lastCall: true
      }),
    /**
     * Wait for something to happen in the DOM.
     * Note! you should not have any asserts in the callback function. From cypress-wait-until documentation:
     *    you cannot put assertions inside checkFunction. There is no way to avoid a test failure if an assertion throws an error.
     *    You must manually check what the assertions would check for you.
     *    The most common case is checking that an element exists or not
     * @example
     * ```ts
     * helper.when.waitUntil(() =>
     *   helper.get.elementByTestId('element-test-id', index)
     * );
     * ```
     */
    waitUntil: <ReturnType = any>(
      checkFunction: () =>
        | ReturnType
        | Cypress.Chainable
        | PromiseLike<ReturnType>,
      options?: WaitUntilOptions
    ) => cy.waitUntil(checkFunction, options),
    /**
     * Fires native system click event.
     *
     * @example
     * ```ts
     * <button data-cy="move-right">Move</button>
     * helper.when.realClick('move-right')
     * ```
     */
    realClick: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).realClick(),
    /**
     * Click a DOM element.
     *
     * @example
     * ```ts
     * <button data-cy="move-right">Move</button>
     * helper.when.click('move-right')
     * ```
     */
    click: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).click({ force: true }),

    /** Fires when your app calls the global window.alert() method.
     * The alert will be closed.
     */
    closeAlert: () => cy.on("window:alert", () => true),
    /**
     *
     * Fires when your app calls the global window.confirm() method.
     * The confirmation will be accepted.
     */
    acceptConfirm: () => cy.on("window:confirm", () => true),
    /**
     *
     * Fires when your app calls the global window.confirm() method.
     * The confirmation will be canceled.
     */
    cancelConfirm: () => cy.on("window:confirm", () => false),
    /**
     *
     * Fires when your app calls the global window.prompt() method.
     * The prompt will be cancelled.
     */
    cancelPrompt: () => cy.on("window:prompt", () => false),

    /**
     *
     * Double-click a DOM element.
     */
    dblclick: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).dblclick(),
    /**
     * Right click a DOM element.
     * @param dataTestID
     * @param [index]
     */
    rightclick: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).rightclick(),
    /**
     * overrides native global functions related to time
     * allowing them to be controlled synchronously via helper.when.tick()
     * This includes controlling:
     *    setTimeout
     *    clearTimeout
     *    setInterval
     *    clearInterval
     *    Date Objects
     * The clock starts at the unix epoch (timestamp of 0).
     * This means that when you instantiate new Date in your application, it will have a time of January 1st, 1970.
     */
    clock: () => cy.clock(),
    /**
     * Fires native hover event. Yes, it can test :hover preprocessor.
     * @example
     * ```ts
     * helper.when.hover('consent-terms-agree')
     * ```
     */
    hover: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).realHover(),
    /**
     * Move time after overriding a native time function with helper.when.clock().
     * helper.when.clock() must be called before helper.when.tick()
     * @example
     * ```ts
     * helper.when.clock();
     * helper.when.click('login-button');
     * helper.when.tick(2000);
     * ```
     */
    tick: (ms: number) => cy.tick(ms),
    /**
     * Focus on a DOM element.
     * @example
     * ```ts
     * helper.when.focus('credentials-password')
     * ```
     */
    focus: (dataTestID: string, index?: number, options?: Partial<Cypress.TypeOptions>) =>
      this.get.elementByTestId(dataTestID, index).focus(options),
    /**
     * Blur a focused element.
     * This element must currently be in focus.
     * If you want to ensure an element is focused before blurring,
     * try using helper.when.focus() before helper.when.blur().
     */
    blur: (dataTestID: string, index?: number, options?: Partial<Cypress.TypeOptions>) =>
      this.get.elementByTestId(dataTestID, index).blur(options),
    /**
     * Clear the value of an input or textarea
     */
    clear: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).clear(),
    /**
     * Type into a DOM element, not including special characters
     * @example
     * ```ts
     * helper.when.type('credentials-password', 'new password')
     * ```
     */
    type: (dataTestID: string, keys: string, index?: number, options?: Partial<Cypress.TypeOptions>) =>
      this.get
        .elementByTestId(dataTestID, index)
        .type(keys, { parseSpecialCharSequences: false, ...options }),

    /**
     * Type into a DOM element, including special characters
     * @example
     * ```ts
     * helper.when.typeSpecialChar('credentials-password', '{backspace}')
     * ```
     */
    typeSpecialCharacter: (dataTestID: string, keys: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).type(keys),

    /**
     * Runs a sequence of native press event (via cy.press) Type event is global. Make sure that it is not attached to any field.
     */
    realType: (dataTestID: string, keys: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).realType(keys),
    /**
     * Scroll to the bottom.
     */
    scrollToBottom: () => cy.scrollTo("bottom", { ensureScrollable: false }),
    /**
     * Scroll to the top.
     */
    scrollToTop: () => cy.scrollTo("top", { ensureScrollable: false }),
    /**
     * Check checkbox(es) or radio(s).
     * This element must be an html input element with type checkbox or radio.
     */
    check: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).check({ force: true }),
    /**
     * Uncheck checkbox(es).
     */
    uncheck: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).uncheck({ force: true }),
    /**
     *
     * Toggle radio(s) by dataTestID
     * This element must be an html input element with type radio.
     */
    toggleRadioBySelector: (dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).check({ force: true }),
    /**
     *
     * Check radio(s).
     * This element must be an html input element with type radio.
     */
    toggle: (index: number) =>
      this.get.nthBySelector("radio", index, "type").check({ force: true }),
    /**
     * Select an option with specific text, value, or index within a select html element.
     * @example
     * ```html
     * <select data-hook="fruit-selection">
     *   <option value="456">apples</option>
     *   <option value="457">oranges</option>
     *   <option value="458">bananas</option>
     * </select>
     * ```
     * ```ts
     * helper.when.selectOption('fruit-selection', 0).should('have.value', '456')
     * helper.when.selectOption('fruit-selection', 'oranges').should('have.value', '457')
     * helper.when.selectOption('fruit-selection', 458).should('have.value', '458')
     * ```
     */
    selectOption: (
      dataTestID: string,
      option: string | number,
      index?: number
    ) => this.get.nthBySelector(dataTestID, index).select(option),
    /**
     * Drag an element and drop it in target element
     * @example
     * ```ts
     * helper.when.dragAndDrop(
     *   helper.get.elementByTestId('selected-item', 2),
     *   helper.get.elementByTestId('available-items')
     * )
     * ```
     * @param element element to be dragged
     * @param targetElement target of drag operation
     */
    dragAndDrop: (
      element: Cypress.Chainable<JQuery<HTMLElement>>,
      targetElement: Cypress.Chainable<JQuery<HTMLElement>>
    ) => {
      element
        .realMouseDown({ button: "left", position: "center" })
        .realMouseMove(0, 10, { position: "center" });
      targetElement.realMouseMove(0, 0, { position: "center" }).realMouseUp();
    },
    /**
     * Scopes the execution of a function within an element
     * @example
     * helper.when.within(() => when.click('button-test-id'), 'button-row', 2)
     * @deprecated The method should not be used anymore. Use helper.when.doWithin instead.
     */
    within: (fn: () => void, dataTestID: string, index?: number) =>
      this.when.doWithin(fn, dataTestID, index),

    /**
     * Scopes the execution of a function within an element
     * @example
     * helper.when.doWithin(() => when.click('button-test-id'), 'button-row', 2)
     */
    doWithin: (fn: () => void, dataTestID: string, index?: number) =>
      this.get.elementByTestId(dataTestID, index).within(fn)
  };

  /**
   * @property get - The get property will hold methods which will give our tests access to the “output” of the component in a “black box” fashion
   */
  public get = {
    /**
     * Get one or more DOM elements by selector.
     * @example
     * Get an element with shape="filter-grid"
     * ```ts
     * <clr-icon shape="filter-grid"></clr-icon>
     * helper.get.bySelector("filter-grid", "shape")
     * ```
     * @param selector
     * @param [attribute = defaultDataAttribute (default is "data-cy")]
     */
    bySelector: (
      selector: string,
      attribute: string = this.options.defaultDataAttribute!
    ) => cy.get(`[${attribute}="${selector}"]`),

    /**
     * Get one or more DOM elements by selector.
     * Same as bySelector
     * @example
     * Get an element with shape="filter-grid"
     * ```ts
     * <clr-icon shape="filter-grid"></clr-icon>
     * helper.get.elementBySelector("filter-grid", "shape")
     * ```
     * @param selector
     * @param [attribute = defaultDataAttribute (default is "data-cy")]
     */
    elementBySelector: (
      selector: string,
      attribute: string = this.options.defaultDataAttribute!
    ) => this.get.bySelector(selector, attribute),

    /**
     * Get one or more DOM elements by attribute.
     * @example
     * Get an element with shape="filter-grid"
     * ```ts
     * <clr-icon shape="filter-grid"></clr-icon>
     * helper.get.byAttribute("shape", "filter-grid")
     * ```
     * @param selector
     * @param attribute
     */
    elementByAttribute: (attribute: string, selector: string) =>
      this.get.bySelector(selector, attribute),

    /**
     * Get A DOM element at a specific index from elements.
     * @example
     * // Get the 3rd checkbox
     * ```ts
     * helper.get.nthBySelector("checkbox", 3, "type")
     * ```
     * @param selector
     * @param [index]
     * @param [attribute= defaultDataAttribute (default is "data-cy")]
     */
    nthBySelector: (
      selector: string,
      index?: number,
      attribute: string = this.options.defaultDataAttribute!
    ) =>
      index === undefined
        ? this.get.bySelector(selector, attribute)
        : this.get.bySelector(selector, attribute).eq(index),
    /**
     * Returns specific environment variable or undefined
     * @example
     * // Keeping password in cypress.config file
     * ```ts
     * e2e: {
     *  env: {
     *    password: "Changeme@1",
     *  }
     * }
     * ```
     * // using password during test
     * ```ts
     * helper.get.env("password");
     * ```
     */
    env: (key: string) => Cypress.env(key),
    /**
     * Get the current URL of the page that is currently active.
     * @returns {Cypress.Chainable<string>}
     */
    currentLocation: (): Cypress.Chainable<string> => cy.url(),

    /**
     * Capture a snapshot and compare it to baseline snapshot
     * Run Cypress with --env updateSnapshots=true in order to update the base image files for all of your tests.
     * @param name
     * @param {string} [dataTestID]
     * @param {number} [index]
     * @param {CypressImageSnapshotOptions} [rest]
     * @example
     * ```ts
     * // capture entire window
     * get.imageSnapshot("homepage");
     * ```
     * @example
     * ```ts
     * // capture an element by DataTestId, with threshold
     * get.imageSnapshot("radio-group", {
     *  dataTestID: "radio-group",
     *  failureThreshold: 0.2
     * });
     * ```
     */
    imageSnapshot: (
      name: string,
      { dataTestID, index, ...rest }: SnapshotOptions = {}
    ) =>
      dataTestID
        ? this.get
            .elementByTestId(dataTestID, index)
            .matchImageSnapshot(name, rest)
        : cy.matchImageSnapshot(name, rest),

    /**
     * Returns element's style attribute
     * @example
     * ```ts
     * get.elementsStyleAttribute("button-data-hook", "background-color")
     * ```
     * @param dataTestID
     * @param attributeName
     * @param [index]
     * @returns {Cypress.Chainable<string>}
     */
    elementsStyleAttribute: (
      dataTestID: string,
      attributeName: string,
      index?: number
    ) =>
      this.waitUntilLoadBeforeInvocation(() =>
        this.get.elementByTestId(dataTestID, index).invoke("css", attributeName)
      ),

    /**
     * Get element's property value
     * @example
     * ```ts
     * get.elementsProperty("image", "height")
     * ```
     * @param dataTestID
     * @param propertyName
     * @param [index]
     * @returns
     */
    elementsProperty: (
      dataTestID: string,
      propertyName: keyof JQuery<HTMLElement>,
      index?: number
    ) =>
      this.waitUntilLoadBeforeInvocation(() =>
        this.get.elementByTestId(dataTestID, index).invoke(propertyName)
      ),
    /**
     * Returns element's computed style, including pseudo elements
     * @example
     * ```ts
     * helper.get.elementsComputedStyle('element-test-id', 0, ':before')
     * ```
     *
     * @returns {Cypress.Chainable<CSSStyleDeclaration>}
     */
    elementsComputedStyle: (
      dataTestID: string,
      index?: number,
      pseudoElement?: string
    ): Cypress.Chainable<CSSStyleDeclaration> =>
      this.get
        .elementByTestId(dataTestID, index)
        .then($element =>
          window.getComputedStyle($element.get(0), pseudoElement)
        ),

    /**
     * Returns a specific style of an element, including pseudo elements if specified.
     * @example
     * ```ts
     * helper.get.elementSpecificStyle('element-test-id', 'backgroundImage')
     * ```
     * * ```ts
     * helper.get.elementSpecificStyle('element-test-id', 'backgroundImage', {index: 3, pseudoElement: ':before'})
     * ```
     * @param dataTestID
     * @param styleProperty
     * @param [index]
     * @param [pseudoElement]
     */
    elementComputedStyleProperty: (
      dataTestID: string,
      styleProperty: keyof CSSStyleDeclaration,
      {
        index,
        pseudoElement
      }: {
        index?: number;
        pseudoElement?: string;
      } = {}
    ) =>
      this.get
        .elementsComputedStyle(dataTestID, index, pseudoElement)
        .then((style: CSSStyleDeclaration) =>
          Cypress.Promise.resolve(style[styleProperty])
        ),

    /**
     * @example
     * ```ts
     * then(helper.get.elementsText("parent-job-name", 3)).shouldInclude("Job 3 Name")
     * ```
     * @param dataTestID
     * @param [index]
     * @returns {Cypress.Chainable<string>}
     */
    elementsText: (
      dataTestID: string,
      index?: number
    ): Cypress.Chainable<string> =>
      this.waitUntilLoadBeforeInvocation(() =>
        this.get.elementByTestId(dataTestID, index).invoke("text")
      ),

    /**
     * Get value of input element
     * @example
     * ```ts
     * then(helper.get.inputValue('credentials-password')).shouldEqual("initial password");
     * ```
     * @param dataTestID
     * @param [index]
     * @returns { Cypress.Chainable<string | number | string[]> }
     */
    inputValue: (
      dataTestID: string,
      index?: number
    ): Cypress.Chainable<string | number | string[]> =>
      this.waitUntilLoadBeforeInvocation(() =>
        this.get.elementByTestId(dataTestID, index).invoke("val")
      ),
    /**
     * Get A DOM element at a specific index from elements.
     * @example
     * ```ts
     * helper.when.dragAndDrop(
     *   helper.get.elementByTestId('selected-item', 2),
     *   helper.get.elementByTestId('available-items')
     * ```
     * @param dataTestID
     * @param [index]
     */
    elementByTestId: (dataTestID: string, index?: number) =>
      this.get
        .nthBySelector(dataTestID, index)
        .should(_ => {})
        .then(elements => {
          if (elements.length === 0) {
            return this.get.nthBySelector(dataTestID, index);
          }
          return this.shouldHandleShadowDomSlot(dataTestID)
            ? this.getShadowSlotElement(dataTestID, index)
            : this.get.nthBySelector(dataTestID, index);
        }),
    /**
     * Get the element currently focused in the document.
     * @returns {Cypress.Chainable<JQuery<HTMLElement>>}
     */
    focusedElement: () => cy.focused(),
    /**
     * Get one or more DOM elements by selector. The querying behavior of this command matches exactly how $(…) works in jQuery.
     * *** Note! Using this method may lead to flakey tests! You should use get.elementByTestId ***
     * @example
     * ```ts
     * get.element('.list>li', 3)    // Yield the <li>'s in <.list>
     * get.element('ul li:first')
     * get.element('.dropdown-menu')
     * ```
     * @param selector
     * @param [index]
     */
    element: (selector: string, index?: number) =>
      index ? cy.get(selector).eq(index) : cy.get(selector),
    /**
     * Get the DOM element containing the text.
     * DOM elements can contain more than the desired text and still match.
     * Additionally, Cypress prefers some DOM elements over the deepest element found.
     * *** Note! Using this method may lead to flakey tests! You should use get.elementByTestId ***
     * @example
     * ```ts
     * then(helper.get.elementByText("Avamar")).shouldExist();
     * ```
     * @param content
     * @param [index]
     */
    elementByText: (content: string | RegExp, index?: number) =>
      index === undefined
        ? cy.contains(content)
        : cy.contains(content).eq(index),
    /**
     * Get number of elements with a specific dataTestID
     * @example
     * ```ts
     *  then(helper.get.numberOfElements("migrated-vcenter")).shouldEqual(2);
     * ```
     * @param dataTestID
     * @returns {Cypress.Chainable<number>}
     */
    numberOfElements: (dataTestID: string): Cypress.Chainable<number> =>
      this.get.bySelector(dataTestID).its("length"),
    /**
     * Get number of outgoing request with a specific alias
     * @example
     * ```ts
     *  then(helper.get.numberOfCalls("fetch-pokemon")).shouldEqual(2);
     * ```
     * @param alias
     * @returns {Cypress.Chainable<number>}
     */
    numberOfRequests: (alias: string): Cypress.Chainable<number> =>
      cy.get(`@${alias}.all`).its("length"),

    /**
     * @example
     * ```ts
     * then(helper.get.elementsAttribute('avatar-picture', 'style')).shouldInclude('background-image: url("assets/avatar/def-user-male.png")')
     * ```
     * @param dataTestID
     * @param attributeName
     * @param [index]
     * @returns {Cypress.Chainable<string | undefined>}
     */
    elementsAttribute: (
      dataTestID: string,
      attributeName: string,
      index?: number
    ): Cypress.Chainable<string | undefined> =>
      this.waitUntilLoadBeforeInvocation(() =>
        this.get
          .elementByTestId(dataTestID, index)
          .invoke("attr", attributeName)
      ),

    /**
     * Get fixture
     * @param alias
     * @example
     * ```ts
     *  given.fixture("user.json", "user");
     *  then(
     *    get.fixture("user").shouldDeepNestedInclude({
     *    name: "Jane Doe",
     *    id: "1234",
     *    nested: {
     *     attr1: "something",
     *     attr2: "the other thing"
     *    }
     *  })
     * );
     * ```
     */
    fixture: (alias: string): Cypress.Chainable<any> => cy.get(`@${alias}`),

    /**
     * Get intercepted response's header
     * @param alias
     * @returns { Cypress.Chainable<{ [key: string]: string | string[]}>}
     */
    responseHeader: (
      alias: string
    ): Cypress.Chainable<{
      [key: string]: string | string[];
    }> => this.when.waitForResponse(alias).then(xhr => xhr.response!.headers),

    /**
     * Get intercepted response's body
     * If a JSON Content-Type was used and the body was valid JSON, this will be an object.
     * If the body was binary content, this will be a buffer.
     * @param alias
     * @returns {Cypress.Chainable<any>}
     */
    responseBody: (alias: string): Cypress.Chainable<any> =>
      this.when.waitForResponse(alias).then(xhr => xhr.response!.body),
    /**
     * Get intercepted request's body
     * If a JSON Content-Type was used and the body was valid JSON, this will be an object.
     * If the body was binary content, this will be a buffer.
     * @param alias
     * @returns {Cypress.Chainable<any>}
     */
    requestBody: (alias: string): Cypress.Chainable<any> =>
      this.when.waitForResponse(alias).then(xhr => xhr.request.body),
    /**
     * Get intercepted request's url
     * @param alias
     * @returns {Cypress.Chainable<string>}
     */
    requestUrl: (alias: string): Cypress.Chainable<string> =>
      this.when.waitForResponse(alias).then(xhr => xhr.request.url),
    /**
     * Get intercepted request's header
     * @param alias
     * @returns { Cypress.Chainable<{ [key: string]: string | string[]}>}
     */
    requestHeader: (
      alias: string
    ): Cypress.Chainable<{ [key: string]: string | string[] }> =>
      this.when.waitForResponse(alias).then(xhr => xhr.request.headers),

    /**
     * Get intercepted request's query param
     * @param alias
     * @param queryParam
     * @returns { Cypress.Chainable<{[k: string]: string;}>}
     */
    requestQueryParams: (
      alias: string
    ): Cypress.Chainable<{ [k: string]: string }> =>
      this.when
        .waitForResponse(alias)
        .then(xhr =>
          Object.fromEntries(
            new URLSearchParams(new URL(xhr.request.url).search)
          )
        ),

    /**
     * Get spy by alias
     * @param name
     * @returns
     */
    spy: (name: string) => cy.get(`@${name}Spy`),
    /**
     * Get spy by function name alias
     * @param func
     * @returns
     */
    spyFromFunction: (func: Function) => cy.get(`@${func.name}`),
    /**
     * Get stub by alias
     * @param name
     * @returns
     */
    stub: (name: string) => cy.get(`@${name}`),
    /**
     * Get stub as Cypress.Chainable
     * @example
     * ```ts
     * const serviceMock : Service = helper.given.stubbedInstance(Service);
     * helper.get.assertableStub(serviceMock.function).should('have.been.called'));
     * ```
     * @deprecated The method should not be used anymore, use `then` instead
     * ```ts
     * then(serviceMock.function).shouldHaveBeenCalled();
     * ```
     */
    assertableStub: (stub: any) => cy.wrap(stub),

    /** Get the window object of the page that is currently active.
     * @returns {Cypress.Chainable<Window>}
     * @example
     * ```ts
     * helper.get.window().then((win) => { win.localStorage.getItem("key")}
     * ```
     */
    window: () => cy.window()
  };
}
