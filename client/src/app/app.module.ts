import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'

import { AppComponent } from './app.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { AboutDialogComponent } from './about-dialog/about-dialog.component'
import { FormsModule } from '@angular/forms'
import { MatButtonModule, MatButtonToggleModule, MatCardModule, MatDialogModule, MatIconModule, MatInputModule, MatMenuModule, MatSnackBarModule, MatToolbarModule } from '@angular/material';

@NgModule({
  declarations: [
    AppComponent,
    AboutDialogComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSnackBarModule,
    MatToolbarModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  entryComponents: [
    AboutDialogComponent
  ]
})
export class AppModule { }
