import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { VmwareComponent } from './vmware.component';

describe('VmwareComponent', () => {
  let fixture: ComponentFixture<VmwareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VmwareComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(VmwareComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
