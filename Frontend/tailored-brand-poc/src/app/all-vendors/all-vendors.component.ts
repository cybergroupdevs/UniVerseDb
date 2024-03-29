import { Component, OnInit } from '@angular/core';
import {VendorService,Vendor} from '../service/vendor.service'
import { PurchaseDialogBoxComponent } from '../purchase-order/purchase-dialog-box.component'
import { MatDialog } from '@angular/material/dialog'
import {MatSnackBar} from '@angular/material'
import {PageEvent} from '@angular/material/paginator';
import { FormGroup, FormBuilder, FormArray, FormControl, Validators } from '@angular/forms';


@Component({
  selector: 'app-all-vendors',
  templateUrl: './all-vendors.component.html',
  styleUrls: ['./all-vendors.component.css']
})
export class AllVendorsComponent implements OnInit {
  length :number;
  pageSize = 5
  pageEvent: PageEvent;
  pageIndex = 0
  rowId : number = 0
 vendorData : Vendor[] = []
 vendorSearch = new FormGroup({
  Name: new FormControl(),
  VendorNo: new FormControl(),
  Company: new FormControl(''),
  Phone: new FormControl('',),
})
  constructor(private vendorService: VendorService , private dialog : MatDialog,private snackBar: MatSnackBar) { }


  ngOnInit() {
    let event = {
      pageIndex: this.pageIndex,
      pageSize: this.pageSize
    }
    this.pagination(event)
  }

  pagination(event){
    this.pageIndex = event.pageIndex
    this.pageSize = event.pageSize

    this.rowId = this.pageIndex * this.pageSize + 1
    let values = this.vendorSearch.value
    this.paginateVendor(values)
  }

  paginateVendor(values){
    values['pageIndex'] = this.pageIndex
    values['pageSize'] = this.pageSize
    
    this.vendorService.list(values)
    .subscribe((res:any)=>{
      this.vendorData  = []
       this.length=res.totalCount
       for(let vendorId in res.data){
         let record = res.data[vendorId]
         this.vendorData.push(
           {
             id: vendorId,
             company: record['vendorCompany'],
             name: record['vendorName'].toString(),
           phone: record['phoneNo'].toString(),
           items: record['itemId'].map(rawItem => {return rawItem})
           }
         )
       }
    },
    error =>{
      this.vendorData = []
      this.length = error.error.totalCount
      this.openSnackBar(error.error.msg, 'Dismiss')
    })
  }
  openDialogBox(msg){
    this.dialog.open(PurchaseDialogBoxComponent,{
      width: '250px',
      data:{ msg: msg}
    })
  }

  downloadFile() {
      let csvData = this.convertToCSV(this.vendorService.vendors, ['S.No','Vendor No', 'Vendor Company', 'Name', 'Phone']);
      let blob = new Blob(['\ufeff' + csvData], { type: 'text/csv;charset=utf-8;' });
      let dwldLink = document.createElement("a");
      let url = URL.createObjectURL(blob);
      let isSafariBrowser = navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1;
      if (isSafariBrowser) {
          dwldLink.setAttribute("target", "_blank");
      }
      dwldLink.setAttribute("href", url);
      dwldLink.setAttribute("download", "all-vendors.csv");
      dwldLink.style.visibility = "hidden";
      document.body.appendChild(dwldLink);
      dwldLink.click();
      document.body.removeChild(dwldLink);
  }

  convertToCSV(vendors, headerList) {
      let str = '';
      let row = '';

      for (let index in headerList) {
          row += headerList[index] + ',';
      }
      row = row.slice(0, -1);
      str += row + '\r\n';
      
      for(let i = 0; i < vendors.length; i++)
      {
        let line = `${i+1}, ${vendors[i].id}, "${vendors[i].company}", "${vendors[i].name}", ${vendors[i].phone}`;
        str += line + '\r\n';
      }
      return str;
  }

  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      duration: 4000,
    });
  }
}
