// ======================================
// Author: Ebenezer Monney
// Copyright (c) 2023 www.ebenmonney.com
// 
// ==> Gun4Hire: contact@ebenmonney.com
// ======================================

import { Directive, forwardRef, Attribute } from '@angular/core';
import { Validator, AbstractControl, NG_VALIDATORS, ValidationErrors } from '@angular/forms';


@Directive({
  selector: '[appValidateEqual][formControlName],[appValidateEqual][formControl],[appValidateEqual][ngModel]',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => EqualValidator), multi: true }
  ]
})
export class EqualValidator implements Validator {
  constructor(@Attribute('appValidateEqual') public validateEqual: string,
    @Attribute('reverse') public reverse: string) {
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const other = control.root.get(this.validateEqual);

    if (!other) {
      return null;
    }

    return this.reverse === 'true' ? this.validateReverse(control, other) : this.validateNoReverse(control, other);
  }

  private validateNoReverse(control: AbstractControl, other: AbstractControl): ValidationErrors | null {
    return other.value === control.value ? null : { validateEqual: true };
  }

  private validateReverse(control: AbstractControl, other: AbstractControl): ValidationErrors | null {
    if (control.value === other.value) {
      if (other.errors) {
        delete other.errors['validateEqual'];

        if (Object.keys(other.errors).length === 0) {
          other.setErrors(null);
        }
      }
    } else {
      other.setErrors({ validateEqual: true });
    }

    return null;
  }
}
