import * as q from 'q';
import * as util from 'util';

import {BrowserError} from '../exitCodes';
import {Logger} from '../logger';
import {DriverProvider} from './driverProvider';

import request = require('request');
import {WebDriver, Session} from 'selenium-webdriver';

const logger = new Logger('crossBrowserTesting');

export class CrossBrowserTesting extends DriverProvider {
  protected setScore(sessionId: string, score: 'pass'|'fail') {
    const deferred = q.defer();
    const uri = 'https://crossbrowsertesting.com/api/v3/selenium/' + sessionId;
    request.put(
        uri, {
          body: {action: 'set_score', score},
          auth: {user: this.config_.cbtUser, pass: this.config_.cbtKey},
          json: true,
        },
        (error: Error, response: request.Response) => {
          if (error) {
            deferred.reject(new BrowserError(
                logger,
                'Error updating CrossBrowserTesting pass/fail status: ' + util.inspect(error)));
          } else if (response.statusCode !== 200) {
            deferred.reject(new BrowserError(
                logger,
                'Error updating CrossBrowserTesting pass/fail status. StatusCode: ' +
                    response.statusCode));
          } else {
            deferred.resolve();
          }
        });
    return deferred.promise;
  }
  protected logUrL(sessionId: string) {
    const deferred = q.defer();
    const url = 'https://crossbrowsertesting.com/api/v3/selenium/' + sessionId + '?format=json';
    request.get(
        url, {
          auth: {user: this.config_.cbtUser, pass: this.config_.cbtKey},
          json: true,
        },
        (err: Error, response: request.Response) => {
          if (err) {
            logger.info(`CrossBrowserTesting results available at
  https://app.crossbrowsertesting.com/selenium/results`);

          } else {
            logger.info(
                `CrossBrowserTesting results available at ${response.body.show_result_public_url}`);
          }
          deferred.resolve();
        });
    return deferred.promise;
  }

  updateJob(update: any): q.Promise<any> {
    return q.all(this.drivers_.map((driver: WebDriver) => {
      const deferred = q.defer();
      const jobStatus = update.passed ? 'pass' : 'fail';
      driver.getSession().then((session: Session) => {
        const sessionId = session.getId();
        const deferredArray = [this.logUrL(sessionId), this.setScore(sessionId, jobStatus)];
        deferred.resolve(q.all(deferredArray));
      });
      return deferred.promise;
    }));
  }

  protected setupDriverEnv(): q.Promise<any> {
    let deferred = q.defer();
    this.config_.capabilities['username'] = this.config_.cbtUser!;
    this.config_.capabilities['password'] = this.config_.cbtKey!;
    this.config_.seleniumAddress = 'http://' + this.config_.cbtUser + ':' + this.config_.cbtKey +
        '@hub.crossbrowsertesting.com:80/wd/hub';

    // Append filename to capabilities.name so that it's easier to identify
    // tests.
    if (this.config_.capabilities.name && this.config_.capabilities.shardTestFiles) {
      this.config_.capabilities.name +=
          ':' + this.config_.specs.toString().replace(/^.*[\\\/]/, '');
    }
    logger.info(
        'Using CrossBrowserTesting selenium server at http://' + this.config_.cbtUser +
        ':REMOVED@hub.crossbrowsertesting.com:80/wd/hub');
    deferred.resolve();
    return deferred.promise;
  }
}