// ======================================
// Author: Ebenezer Monney
// Copyright (c) 2023 www.ebenmonney.com
// 
// ==> Gun4Hire: contact@ebenmonney.com
// ======================================

import { Component, OnInit, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgModel, NgForm } from '@angular/forms';

import { AlertService, MessageSeverity } from '../../services/alert.service';
import { AccountService } from '../../services/account.service';
import { Utilities } from '../../services/utilities';
import { User } from '../../models/user.model';
import { UserEdit } from '../../models/user-edit.model';
import { Role } from '../../models/role.model';
import { Permission } from '../../models/permission.model';

@Component({
  selector: 'app-user-info',
  templateUrl: './user-info.component.html',
  styleUrls: ['./user-info.component.scss']
})
export class UserInfoComponent implements OnInit {
  public isEditMode = false;
  public isNewUser = false;
  public isSaving = false;
  public isChangePassword = false;
  public isEditingSelf = false;
  public showValidationErrors = false;
  public uniqueId = Utilities.uniqueId();
  public user = new User();
  public userEdit = new UserEdit();
  public allRoles: Role[] = [];

  public formResetToggle = true;

  public changesSavedCallback: { (): void } | undefined;
  public changesFailedCallback: { (): void } | undefined;
  public changesCancelledCallback: { (): void } | undefined;

  @Input()
  isViewOnly = false;

  @Input()
  isGeneralEditor = false;

  // Outupt to broadcast this instance so it can be accessible from within ng-bootstrap modal template
  @Output()
  afterOnInit = new EventEmitter<UserInfoComponent>();

  @ViewChild('f')
  public form!: NgForm;

  // ViewChilds required because ngIf hides template variables from global scope within template
  @ViewChild('userName')
  public userName!: NgModel;

  @ViewChild('userPassword')
  public userPassword!: NgModel;

  @ViewChild('email')
  public email!: NgModel;

  @ViewChild('currentPassword')
  public currentPassword!: NgModel;

  @ViewChild('newPassword')
  public newPassword!: NgModel;

  @ViewChild('confirmPassword')
  public confirmPassword!: NgModel;

  @ViewChild('roles')
  public roles!: NgModel;


  constructor(private alertService: AlertService, private accountService: AccountService) {
  }

  ngOnInit() {
    if (!this.isGeneralEditor) {
      this.loadCurrentUserData();
    }

    this.afterOnInit.emit(this);
  }

  private loadCurrentUserData() {
    this.alertService.startLoadingMessage();

    if (this.canViewAllRoles) {
      this.accountService.getUserAndRoles()
        .subscribe({
          next: results => this.onCurrentUserDataLoadSuccessful(results[0], results[1]),
          error: error => this.onCurrentUserDataLoadFailed(error)
        });
    } else {
      this.accountService.getUser()
        .subscribe({
          next: user => this.onCurrentUserDataLoadSuccessful(user, user.roles.map(role => new Role(role))),
          error: error => this.onCurrentUserDataLoadFailed(error)
        });
    }
  }

  private onCurrentUserDataLoadSuccessful(user: User, roles: Role[]) {
    this.alertService.stopLoadingMessage();
    this.user = user;
    this.allRoles = roles;
  }

  private onCurrentUserDataLoadFailed(error: HttpErrorResponse) {
    this.alertService.stopLoadingMessage();
    this.alertService.showStickyMessage('Load Error',
      `Unable to retrieve user data from the server.\r\nError: "${Utilities.getHttpResponseMessage(error)}"`,
      MessageSeverity.error, error);

    this.user = new User();
  }

  getRoleByName(name: string) {
    return this.allRoles.find((r) => r.name === name);
  }

  showErrorAlert(caption: string, message: string) {
    this.alertService.showMessage(caption, message, MessageSeverity.error);
  }

  deletePasswordFromUser(user: UserEdit | User) {
    const userEdit = user as UserEdit;

    delete userEdit.currentPassword;
    delete userEdit.newPassword;
    delete userEdit.confirmPassword;
  }

  edit() {
    if (!this.isGeneralEditor) {
      this.isEditingSelf = true;
      this.userEdit = new UserEdit();
      Object.assign(this.userEdit, this.user);
    } else {
      if (!this.userEdit) {
        this.userEdit = new UserEdit();
      }

      this.isEditingSelf = this.accountService.currentUser ? this.userEdit.id === this.accountService.currentUser.id : false;
    }

    this.isEditMode = true;
    this.showValidationErrors = true;
    this.isChangePassword = false;
  }

  save() {
    this.isSaving = true;
    this.alertService.startLoadingMessage('Saving changes...');

    if (this.isNewUser) {
      this.accountService.newUser(this.userEdit)
        .subscribe({
          next: user => this.saveSuccessHelper(user),
          error: error => this.saveFailedHelper(error)
        });
    } else {
      this.accountService.updateUser(this.userEdit)
        .subscribe({
          next: () => this.saveSuccessHelper(),
          error: error => this.saveFailedHelper(error)
        });
    }
  }

  private saveSuccessHelper(user?: User) {
    this.testIsRoleUserCountChanged(this.user, this.userEdit);

    if (user) {
      Object.assign(this.userEdit, user);
    }

    this.isSaving = false;
    this.alertService.stopLoadingMessage();
    this.isChangePassword = false;
    this.showValidationErrors = false;

    this.deletePasswordFromUser(this.userEdit);
    Object.assign(this.user, this.userEdit);
    this.userEdit = new UserEdit();
    this.resetForm();

    if (this.isGeneralEditor) {
      if (this.isNewUser) {
        this.alertService.showMessage('Success', `User "${this.user.userName}" was created successfully`, MessageSeverity.success);
      } else if (!this.isEditingSelf) {
        this.alertService.showMessage('Success', `Changes to user "${this.user.userName}" was saved successfully`, MessageSeverity.success);
      }
    }

    if (this.isEditingSelf) {
      this.alertService.showMessage('Success', 'Changes to your User Profile was saved successfully', MessageSeverity.success);
      this.refreshLoggedInUser();
    }

    this.isEditMode = false;

    if (this.changesSavedCallback) {
      this.changesSavedCallback();
    }
  }

  private saveFailedHelper(error: HttpErrorResponse) {
    this.isSaving = false;
    this.alertService.stopLoadingMessage();
    this.alertService.showStickyMessage('Save Error', 'The below errors occurred whilst saving your changes:', MessageSeverity.error, error);
    this.alertService.showStickyMessage(error, null, MessageSeverity.error);

    if (this.changesFailedCallback) {
      this.changesFailedCallback();
    }
  }

  private testIsRoleUserCountChanged(currentUser: User, editedUser: User) {
    const rolesAdded = this.isNewUser ? editedUser.roles : editedUser.roles.filter(role => currentUser.roles.indexOf(role) === -1);
    const rolesRemoved = this.isNewUser ? [] : currentUser.roles.filter(role => editedUser.roles.indexOf(role) === -1);

    const modifiedRoles = rolesAdded.concat(rolesRemoved);

    if (modifiedRoles.length) {
      setTimeout(() => this.accountService.onRolesUserCountChanged(modifiedRoles));
    }
  }

  cancel() {
    if (this.isGeneralEditor) {
      this.userEdit = this.user = new UserEdit();
    } else {
      this.userEdit = new UserEdit();
    }

    this.showValidationErrors = false;
    this.resetForm();

    this.alertService.showMessage('Cancelled', 'Operation cancelled by user', MessageSeverity.default);
    this.alertService.resetStickyMessage();

    if (!this.isGeneralEditor) {
      this.isEditMode = false;
    }

    if (this.changesCancelledCallback) {
      this.changesCancelledCallback();
    }
  }

  close() {
    this.userEdit = this.user = new UserEdit();
    this.showValidationErrors = false;
    this.resetForm();
    this.isEditMode = false;

    if (this.changesSavedCallback) {
      this.changesSavedCallback();
    }
  }

  private refreshLoggedInUser() {
    this.accountService.refreshLoggedInUser()
      .subscribe({
        next: () => {
          this.loadCurrentUserData();
        },
        error: error => {
          this.alertService.resetStickyMessage();
          this.alertService.showStickyMessage('Refresh failed',
            'An error occurred whilst refreshing logged in user information from the server', MessageSeverity.error, error);
        }
      });
  }

  changePassword() {
    this.isChangePassword = true;
  }

  unlockUser() {
    this.isSaving = true;
    this.alertService.startLoadingMessage('Unblocking user...');

    this.accountService.unblockUser(this.userEdit.id)
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.userEdit.isLockedOut = false;
          this.alertService.stopLoadingMessage();
          this.alertService.showMessage('Success', 'User has been successfully unblocked', MessageSeverity.success);
        },
        error: error => {
          this.isSaving = false;
          this.alertService.stopLoadingMessage();
          this.alertService.showStickyMessage('Unblock Error',
            'The below errors occurred whilst unblocking the user:', MessageSeverity.error, error);
          this.alertService.showStickyMessage(error, null, MessageSeverity.error);
        }
      });
  }

  resetForm(replace = false) {
    this.isChangePassword = false;

    if (!replace) {
      this.form.reset();
    } else {
      this.formResetToggle = false;

      setTimeout(() => {
        this.formResetToggle = true;
      });
    }
  }

  newUser(allRoles: Role[]) {
    this.isGeneralEditor = true;
    this.isNewUser = true;

    this.allRoles = [...allRoles];
    this.user = this.userEdit = new UserEdit();
    this.userEdit.isEnabled = true;
    this.edit();

    return this.userEdit;
  }

  editUser(user: User, allRoles: Role[]) {
    if (user) {
      this.isGeneralEditor = true;
      this.isNewUser = false;

      this.setRoles(user, allRoles);
      this.user = new User();
      this.userEdit = new UserEdit();
      Object.assign(this.user, user);
      Object.assign(this.userEdit, user);
      this.edit();

      return this.userEdit;
    } else {
      return this.newUser(allRoles);
    }
  }

  displayUser(user: User, allRoles?: Role[]) {
    this.user = new User();
    Object.assign(this.user, user);
    this.deletePasswordFromUser(this.user);
    this.setRoles(user, allRoles);

    this.isEditMode = false;
  }

  private setRoles(user: User, allRoles?: Role[]) {
    this.allRoles = allRoles ? [...allRoles] : [];

    for (const role of user.roles) {
      if (!this.allRoles.some(r => r.name === role)) {
        this.allRoles.unshift(new Role(role));
      }
    }
  }

  get canViewAllRoles() {
    return this.accountService.userHasPermission(Permission.viewRoles);
  }

  get canAssignRoles() {
    return this.accountService.userHasPermission(Permission.assignRoles);
  }
}
