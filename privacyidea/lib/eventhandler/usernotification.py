# -*- coding: utf-8 -*-
#
#  2016-10-12 Cornelius Kölbel <cornelius.koelbel@netknights.it>
#             Add tokentype, tokenrealm and serial
#             Add multi and regexp
#  2016-07-18 Cornelius Kölbel <cornelius.koelbel@netknights.it>
#             Add notification conditions
#  2016-05-06 Cornelius Kölbel <cornelius.koelbel@netknights.it>
#             Initial writup
#
# License:  AGPLv3
# (c) 2016. Cornelius Kölbel
#
# This code is free software; you can redistribute it and/or
# modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
# License as published by the Free Software Foundation; either
# version 3 of the License, or any later version.
#
# This code is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU AFFERO GENERAL PUBLIC LICENSE for more details.
#
# You should have received a copy of the GNU Affero General Public
# License along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
#
__doc__ = """This is the event handler module for user notifications.
It can be bound to each event and can perform the action:

  * sendmail: Send an email to the user/token owner
  * sendsms: We can also notify the user with an SMS.

The module is tested in tests/test_lib_events.py
"""
from privacyidea.lib.eventhandler.base import BaseEventHandler
from privacyidea.lib.smtpserver import send_email_identifier
from privacyidea.lib.smsprovider.SMSProvider import send_sms_identifier
from privacyidea.lib.auth import ROLE, get_db_admins, get_db_admin
from privacyidea.lib.token import get_token_owner, get_tokens
from privacyidea.lib.realm import get_realms
from privacyidea.lib.smtpserver import get_smtpservers
from privacyidea.lib.smsprovider.SMSProvider import get_smsgateway
from privacyidea.lib.config import get_token_types
from privacyidea.lib.user import User, get_user_list
from gettext import gettext as _
from flask import current_app
import json
import logging
import re
log = logging.getLogger(__name__)

DEFAULT_BODY = """
Hello {user},

the administrator {admin}@{realm} performed the action
{action} on your token {serial}.

To check your tokens you may login to the Web UI:
{url}
"""


class NOTIFY_TYPE(object):
    """
    Allowed token owner
    """
    TOKENOWNER = "tokenowner"
    LOGGED_IN_USER = "logged_in_user"
    INTERNAL_ADMIN = "internal admin"
    ADMIN_REALM = "admin realm"
    EMAIL = "email"


class UserNotificationEventHandler(BaseEventHandler):
    """
    An Eventhandler needs to return a list of actions, which it can handle.

    It also returns a list of allowed action and conditions

    It returns an identifier, which can be used in the eventhandlig definitions
    """

    identifier = "UserNotification"
    description = "This eventhandler notifies the user about actions on his " \
                  "tokens"

    @property
    def actions(cls):
        """
        This method returns a dictionary of allowed actions and possible
        options in this handler module.

        :return: dict with actions
        """
        smtpserver_objs = get_smtpservers()
        smsgateway_dicts = get_smsgateway()
        smsgateways = [sms.identifier for sms in smsgateway_dicts]
        smtpservers = [s.config.identifier for s in smtpserver_objs]
        actions = {"sendmail": {"emailconfig":
                                     {"type": "str",
                                      "required": True,
                                      "description": _("Send notification "
                                                       "email via this "
                                                       "email server."),
                                      "value": smtpservers},
                                "subject": {"type": "str",
                                            "required": False,
                                            "description": _("The subject of "
                                                             "the mail that "
                                                             "is sent.")


                                },
                                "body": {"type": "text",
                                         "required": False,
                                         "description": _("The body of the "
                                                          "mail that is "
                                                          "sent.")},
                                "To": {"type": "str",
                                       "required": True,
                                       "description": _("Send notification to "
                                                        "this user."),
                                       "value": [
                                           NOTIFY_TYPE.TOKENOWNER,
                                           NOTIFY_TYPE.LOGGED_IN_USER,
                                           NOTIFY_TYPE.INTERNAL_ADMIN,
                                           NOTIFY_TYPE.ADMIN_REALM,
                                           NOTIFY_TYPE.EMAIL]},
                                "To "+NOTIFY_TYPE.ADMIN_REALM: {
                                    "type": "str",
                                    "value": current_app.config.get(
                                        "SUPERUSER_REALM", []),
                                    "visibleIf": "To",
                                    "visibleValue": NOTIFY_TYPE.ADMIN_REALM},
                                "To "+NOTIFY_TYPE.INTERNAL_ADMIN: {
                                    "type": "str",
                                    "value": [a.username for a in
                                              get_db_admins()],
                                    "visibleIf": "To",
                                    "visibleValue":
                                         NOTIFY_TYPE.INTERNAL_ADMIN},
                                "To "+NOTIFY_TYPE.EMAIL: {
                                    "type": "str",
                                    "description": _("Any email address, to "
                                                     "which the notification "
                                                     "should be sent."),
                                    "visibleIf": "To",
                                    "visibleValue": NOTIFY_TYPE.EMAIL}
                                },
                   "sendsms": {"smsconfig":
                                   {"type": "str",
                                    "required": True,
                                    "description": _("Send the user "
                                                     "notification via a "
                                                     "predefined SMS "
                                                     "gateway."),
                                    "value": smsgateways},
                               "body": {"type": "text",
                                        "required": False,
                                        "description": _("The text of the "
                                                         "SMS.")},
                               "To": {"type": "str",
                                      "required": True,
                                      "description": _("Send notification to "
                                                       "this user."),
                                      "value": [NOTIFY_TYPE.TOKENOWNER]}
                               }
                   }
        return actions

    @property
    def conditions(cls):
        """
        The UserNotification can filter for conditions like
        * type of logged in user and
        * successful or failed value.success

        allowed types are str, multi, text, regexp

        :return: dict
        """
        realms = get_realms()
        cond = {
            "realm": {
                "type": "str",
                "desc": _("The user realm, for which this event should apply."),
                "value": realms.keys()
            },
            "tokenrealm": {
                "type": "multi",
                "desc": _("The token realm, for which this event should "
                          "apply."),
                "value": [{"name": r} for r in realms.keys()]
            },
            "tokentype": {
                "type": "multi",
                "desc": _("The type of the token."),
                "value": [{"name": r} for r in get_token_types()]
            },
            "logged_in_user": {
                "type": "str",
                "desc": _("The logged in user is of the following type."),
                "value": (ROLE.ADMIN, ROLE.USER)
            },
            "result_value": {
                "type": "str",
                "desc": _("The result.value within the response is "
                          "True or False."),
                "value": ("True", "False")
            },
            "token_locked": {
                "type": "str",
                "desc": _("Check if the max failcounter of the token is "
                          "reached."),
                "value": ("True", "False")
            },
            "serial": {
                "type": "regexp",
                "desc": _("Action is triggered, if the serial matches this "
                          "regular expression.")
            }
        }
        return cond

    @staticmethod
    def _get_tokenowner(request):
        user = request.User
        serial = request.all_data.get("serial")
        if user.is_empty() and serial:
            # maybe the user is empty, but a serial was passed.
            # Then we determine the user by the serial
            user = get_token_owner(serial) or User()
        return user

    def check_condition(self, options):
        """
        Check if all conditions are met and if the action should be executed.
        The the conditions are met, we return "True"
        :return: True
        """
        res = True
        g = options.get("g")
        request = options.get("request")
        response = options.get("response")
        e_handler_def = options.get("handler_def")
        # conditions can be correspnding to the property conditions
        conditions = e_handler_def.get("conditions")
        content = json.loads(response.data)
        user = self._get_tokenowner(request)

        serial = request.all_data.get("serial") or \
                 content.get("detail", {}).get("serial")
        token_obj_list = get_tokens(serial=serial)
        tokenrealms = []
        tokentype = None
        if token_obj_list:
            tokenrealms = token_obj_list[0].get_realms()
            tokentype = token_obj_list[0].get_tokentype()

        if "realm" in conditions:
            res = user.realm == conditions.get("realm")

        if "logged_in_user" in conditions and res:
            # Determine the role of the user
            try:
                logged_in_user = g.logged_in_user
                user_role = logged_in_user.get("role")
            except Exception:
                # A non-logged-in-user is a User, not an admin
                user_role = ROLE.USER
            res = user_role == conditions.get("logged_in_user")

        # Check result_value only if the check condition is still True
        if "result_value" in conditions and res:
            res = content.get("result", {}).get("value") == conditions.get(
                "result_value")

        # checking of max-failcounter state of the token
        if "token_locked" in conditions and res:
            if serial:
                # There is a distinct serial number
                tokens = get_tokens(serial=serial)
                if tokens:
                    token_obj = tokens[0]
                    locked = token_obj.get_failcount() >= \
                             token_obj.get_max_failcount()
                    res = (conditions.get("token_locked") in ["True", True]) \
                          == locked
            else:
                # check all tokens of the user, if any token is maxfail
                token_objects = get_tokens(user=user, maxfail=True)
                if not ','.join([tok.get_serial() for tok in token_objects]):
                    res = False

        if "tokenrealm" in conditions and res:
            if tokenrealms:
                res = False
                for trealm in tokenrealms:
                    if trealm in conditions.get("tokenrealm").split(","):
                        res = True
                        break

        if "tokentype" in conditions and res:
            if tokentype:
                res = False
                if tokentype in conditions.get("tokentype").split(","):
                    res = True

        if "serial" in conditions and res:
            serial_match = conditions.get("serial")
            if serial:
                res = bool(re.match(serial_match, serial))

        return res

    def do(self, action, options=None):
        """
        This method executes the defined action in the given event.

        :param action:
        :param options: Contains the flask parameters g, request, response
            and the handler_def configuration
        :type options: dict
        :return:
        """
        ret = True
        g = options.get("g")
        request = options.get("request")
        response = options.get("response")
        content = json.loads(response.data)
        handler_def = options.get("handler_def")
        handler_options = handler_def.get("options", {})
        notify_type = handler_options.get("To", NOTIFY_TYPE.TOKENOWNER)
        try:
            logged_in_user = g.logged_in_user
        except Exception:
            logged_in_user = {}

        tokenowner = self._get_tokenowner(request)
        log.debug("Executing event for action {0!s}, user {1!s},"
                  "logged_in_user {2!s}".format(action, tokenowner,
                                                logged_in_user))

        # Determine recipient
        recipient = None

        if notify_type == NOTIFY_TYPE.TOKENOWNER and not tokenowner.is_empty():
            recipient = {
                "givenname": tokenowner.info.get("givenname"),
                "surname": tokenowner.info.get("surname"),
                "username": tokenowner.login,
                "userrealm": tokenowner.realm,
                "email": tokenowner.info.get("email"),
                "mobile": tokenowner.info.get("mobile")
            }
        elif notify_type == NOTIFY_TYPE.INTERNAL_ADMIN:
            username = handler_options.get("To "+NOTIFY_TYPE.INTERNAL_ADMIN)
            internal_admin = get_db_admin(username)
            recipient = {
                "givenname": username,
                "email": internal_admin.email if internal_admin else ""
            }
        elif notify_type == NOTIFY_TYPE.ADMIN_REALM:
            # Send emails to all the users in the specified admin realm
            admin_realm = handler_options.get("To "+NOTIFY_TYPE.ADMIN_REALM)
            ulist = get_user_list({"realm": admin_realm})
            # create a list of all user-emails, if the user has an email
            emails = [u.get("email") for u in ulist if u.get("email")]
            recipient = {
                "givenname": "admin of realm {0!s}".format(admin_realm),
                "email": emails
            }
        elif notify_type == NOTIFY_TYPE.LOGGED_IN_USER:
            # Send notification to the logged in user
            if logged_in_user.get("user") and not logged_in_user.get("realm"):
                # internal admins have no realm
                internal_admin = get_db_admin(logged_in_user.get("user"))
                if internal_admin:
                    recipient = {
                        "givenname": logged_in_user.get("user"),
                        "email": internal_admin.email if internal_admin else ""
                    }
            else:
                # Try to find the user in the specified realm
                user_obj = User(logged_in_user.get("user"),
                                logged_in_user.get("realm"))
                if user_obj:
                    recipient = {
                        "givenname": user_obj.info.get("givenname"),
                        "surname": user_obj.info.get("surname"),
                        "email": user_obj.info.get("email"),
                        "mobile": user_obj.info.get("mobile")
                    }

        elif notify_type == NOTIFY_TYPE.EMAIL:
            email = handler_options.get("To "+NOTIFY_TYPE.EMAIL, "").split(",")
            recipient = {
                "email": email
            }
        else:
            log.warning("Was not able to determine the recipient for the user "
                        "notification: {0!s}".format(handler_def))

        if recipient:
            # Collect all data
            body = handler_options.get("body") or DEFAULT_BODY
            serial = request.all_data.get("serial") or \
                     content.get("detail", {}).get("serial") or \
                     g.audit_object.audit_data.get("serial")
            registrationcode = content.get("detail", {}).get("registrationcode")
            tokentype = None
            if serial:
                tokens = get_tokens(serial=serial)
                if tokens:
                    tokentype = tokens[0].get_tokentype()
            else:
                token_objects = get_tokens(user=tokenowner)
                serial = ','.join([tok.get_serial() for tok in token_objects])

            body = body.format(
                admin=logged_in_user.get("username"),
                realm=logged_in_user.get("realm"),
                action=request.path,
                serial=serial,
                url=request.url_root,
                user=tokenowner.info.get("givenname"),
                surname=tokenowner.info.get("surname"),
                givenname=recipient.get("givenname"),
                username=tokenowner.login,
                userrealm=tokenowner.realm,
                tokentype=tokentype,
                registrationcode=registrationcode,
                recipient_givenname=recipient.get("givenname"),
                recipient_surname=recipient.get("surname")
            )

            # Send notification
            if action.lower() == "sendmail":
                emailconfig = handler_options.get("emailconfig")
                useremail = recipient.get("email")
                subject = handler_options.get("subject") or \
                          "An action was performed on your token."
                try:
                    ret = send_email_identifier(emailconfig,
                                                recipient=useremail,
                                                subject=subject, body=body)
                except Exception as exx:
                    log.error("Failed to send email: {0!s}".format(exx))
                    ret = False
                if ret:
                    log.info("Sent a notification email to user {0}".format(
                        recipient))
                else:
                    log.warning("Failed to send a notification email to user "
                                "{0}".format(recipient))

            elif action.lower() == "sendsms":
                smsconfig = handler_options.get("smsconfig")
                userphone = recipient.get("mobile")
                try:
                    ret = send_sms_identifier(smsconfig, userphone, body)
                except Exception as exx:
                    log.error("Failed to send sms: {0!s}".format(exx))
                    ret = False
                if ret:
                    log.info("Sent a notification sms to user {0}".format(
                        recipient))
                else:
                    log.warning("Failed to send a notification email to user "
                                "{0}".format(recipient))

        return ret


