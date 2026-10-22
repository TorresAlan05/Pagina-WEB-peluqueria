import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminServicios } from './admin-servicios';

describe('AdminServicios', () => {
  let component: AdminServicios;
  let fixture: ComponentFixture<AdminServicios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminServicios],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminServicios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
