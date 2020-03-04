import { Component, OnInit } from '@angular/core'
import { FormGroup, FormControl, FormBuilder, FormArray, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { MatSnackBar } from "@angular/material";
import { PurchaseOrderService } from '../service/purchase-order.service'
import { StateService } from '../service/state.service'
import { MatDialog } from '@angular/material/dialog'
import { PurchaseDialogBoxComponent } from './purchase-dialog-box.component'
import { VendorService } from '../service/vendor.service';

@Component({
  selector: 'purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.css']
})
export class PurchaseOrderComponent implements OnInit {

  selectedState: string = ""
  selectedVendor: string = ""
  selectedItem: string = ""
  itemList: Array<any> = []
  itemOrderForm: FormGroup
  vendorNameList = []
  vendorItemIDList = []
  vendorObject = []
  editForm: boolean
  purchaseOrderTitle: string
  grandTotal: number = 0.00
  date: string = new Date().toISOString().substr(0, 10)
  itemOrderError : boolean
  lastId:number;
  showButtons : boolean = true

  constructor(
    private purchaseOrderService: PurchaseOrderService,
    private fb: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    public snackBar: MatSnackBar,
    private stateService: StateService,
    private vendorService: VendorService
  ) {
  }
  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
       duration: 4000,
    });
 }

  purchaseOrderForm = new FormGroup({
    NewOrder: new FormControl(''),
    OrderDate: new FormControl('', Validators.required),
    VendorName: new FormControl('', Validators.required),
    CompanyName: new FormControl('', Validators.required),
    Street: new FormControl('', Validators.required),
    State: new FormControl('', Validators.required),
    PhoneNumber: new FormControl('', Validators.required),
    ContactName: new FormControl('', Validators.required),
    City: new FormControl('', Validators.required),
    ZipCode: new FormControl('', [Validators.required])
  })

  ngOnInit() {
    this.itemOrderForm = this.fb.group({
      VendorItem: new FormControl(''),
      SpecialRequests: this.fb.array([])
    })

    this.editForm = this.router.url.endsWith('/edit')
    if (!this.editForm) {
      this.purchaseOrderForm.controls['NewOrder'].disable()
      this.purchaseOrderTitle = 'Create Purchase Order'
    }
    else {
      this.purchaseOrderTitle = 'Update Purchase Order'
    }
  }

  createNewFormControl(itemID, itemDescription, quantity, unitCost) {
    const control = <FormArray>this.itemOrderForm.controls['SpecialRequests']
    control.push(this.initiateForm(itemID, itemDescription, quantity, unitCost))
  }


  initiateForm(itemID, itemDescription, quantity, unitCost): FormGroup {
    return this.fb.group({
      ItemID: [itemID],
      ItemDescription: [itemDescription],
      Quantity: new FormControl(quantity, Validators.required),
      UnitCost: new FormControl(unitCost, Validators.required),
      TotalPrice: [0]
    })
  }

  getItemOrderDetail(event) {
    let orderID = this.purchaseOrderForm.get('NewOrder').value
    if (event.keyCode === 13 && this.editForm && orderID != '' && orderID !=this.lastId) {
      this.lastId=orderID
      this.purchaseOrderService.get(orderID)
        .subscribe((res: any) => {
          if (res.status === 404) {
            this.openSnackBar(`${orderID} does not exists`, 'Dismiss')
            this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
              this.router.navigate(['/order/edit']);
          }); 
            
          }
          else {
            this.purchaseOrderTitle = "Update Purchase Order "+orderID
            this.setItemOrderDetails(res)
          }
        })
    }
  }

  setItemOrderDetails(res: any) {
    let submitBool = false
    for (let i in res.data) {
      this.purchaseOrderForm.controls[i].setValue(res.data[i])
      if (res.submitStatus === 'submit') {
        this.purchaseOrderForm.controls[i].disable()
      }
    }

    if (res.submitStatus === 'submit') {
      this.showButtons = false
      submitBool = true
    }

    for (let j in res.itemList) {
      let itemDescription :string
      let cost = res.itemList[j].Cost
      let quantity = res.itemList[j].Quantity
      let vendorItem = res.itemList[j].ItemID
      this.createNewFormControl(vendorItem, itemDescription, quantity, cost)
      this.calculateTotalPrice(j, submitBool)
    }
  }

  selectState(event) {
    this.selectedState = event.item.split("|")[0].trim();
    this.purchaseOrderForm.controls['State'].setValue(this.selectedState);
  }

  selectVendor(event) {
    this.vendorService.select(event.item.split("|")[0].trim())
    this.purchaseOrderForm.controls['VendorName'].setValue(event.item.split("|")[0].trim());
  }

  selectItem(event) {
    let itemId = event.item.split("|")[0].trim()
    if (itemId != 'None') {
      this.itemOrderError = false
      let selectedItem = this.vendorService.selectedVendor.items.find(item => item.id == itemId)
      this.createNewFormControl(selectedItem.id, selectedItem.description, "", "")
    }
    // Workaround to clear the typeahead box after user makes a selection
    if(this.selectedItem == "")
      this.selectedItem = null
    else
      this.selectedItem = ""  
  }

  removeParticularItem(index: number) {
    if(!this.editForm){
      let control = <FormArray>this.itemOrderForm.get('SpecialRequests')
      control.removeAt(index)
    }
  }

  calculateTotalPrice(index, submitBool) {
    let controlArray = <FormArray>this.itemOrderForm.get('SpecialRequests')
    let quantity = controlArray.value[index].Quantity
    let unitCost = controlArray.value[index].UnitCost
    this.grandTotal = 0.00
    if (quantity != "" || unitCost != "") {
      let totalPrice = quantity * unitCost
      controlArray.controls[index].get('TotalPrice').setValue(totalPrice)
      if (submitBool) {
        controlArray.controls[index].get('Quantity').disable()
        controlArray.controls[index].get('UnitCost').disable()
      }
      controlArray.controls.forEach(control => {
        let price = Number.parseFloat(control.get('TotalPrice').value)
        this.grandTotal += price
      })
    }

  }

  submitNewOrder(purchaseOrderForm, itemOrderForm, submitStatus) {
    let recordId
    if (this.editForm) {
      recordId = this.purchaseOrderForm.get('NewOrder').value
    }
    else {
      recordId = Math.floor(Math.random() * 900000) + 100000
    }
    if (!this.checkValidation()) {
      return;
    }

    if(purchaseOrderForm.value.VendorName.indexOf('|') > -1){
      let name = purchaseOrderForm.value.VendorName.split('|')[1].trim()
      purchaseOrderForm.value.VendorName =  name
    }
    
    this.purchaseOrderService.post(purchaseOrderForm.value, itemOrderForm.value, recordId, submitStatus, this.editForm)
      .subscribe((res) => {
        let msg
        if (this.editForm) {
          msg = `Order ${recordId} updated`
          this.openSnackBar(`${msg}`, 'Dismiss')
          this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
            this.router.navigate(['/order/edit']);
        });
        }
        else {
          msg = `Order ${recordId} Created`
          this.openSnackBar(`${msg}`, 'Dismiss')
          this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
            this.router.navigate(['/order/new']);
        });
        } 
      })
  }

  checkForExponential(event) {
    return event.keyCode == 69 || event.keyCode == 190 || event.keyCode == 107 || (event.keyCode >=65 && event.keyCode <=90) ? false : true
  }

  checkValidation() {
    let status = true
    if (this.purchaseOrderForm.invalid) {
      this.purchaseOrderForm.get('CompanyName').markAsTouched()
      this.purchaseOrderForm.get('City').markAsTouched()
      this.purchaseOrderForm.get('ZipCode').markAsTouched()
      this.purchaseOrderForm.get('PhoneNumber').markAsTouched()
      this.purchaseOrderForm.get('ContactName').markAsTouched()
      this.purchaseOrderForm.get('Street').markAsTouched()
      this.purchaseOrderForm.get('VendorName').markAsTouched()
      this.purchaseOrderForm.get('State').markAsTouched()
      this.purchaseOrderForm.get('OrderDate').markAsTouched()
      status = false
    }

    if(this.itemOrderForm.untouched) this.itemOrderError = true
    else this.itemOrderError = false

    if (this.itemOrderForm.invalid || !this.itemOrderForm.touched) {
      (<FormArray>this.itemOrderForm.get('SpecialRequests')).controls.forEach((group: FormGroup) => {
        (<any>Object).values(group.controls).forEach((control: FormControl) => {
          control.markAsTouched()
        })
      })
      status = false
    }
    return status
  }

  openDialogBox(msg){
    this.dialog.open(PurchaseDialogBoxComponent,{
      width: '450px',
      data:{ msg: msg}
    })
  }
}