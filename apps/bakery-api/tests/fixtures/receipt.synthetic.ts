export const EXAMPLE_IBAN = 'DE89370400440532013000'

export function ubl(number = 'BM-0815') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${number}</cbc:ID>
  <cbc:IssueDate>2026-11-12</cbc:IssueDate><cbc:DueDate>2026-11-22</cbc:DueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>Beispiel-Mühle &amp; Co.</cbc:RegistrationName></cac:PartyLegalEntity>
    <cac:PartyTaxScheme><cbc:CompanyID>DE000000000</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>59</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount><cbc:ID>${EXAMPLE_IBAN}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal><cac:TaxSubtotal>
    <cbc:TaxableAmount>100.00</cbc:TaxableAmount><cbc:TaxAmount>7.00</cbc:TaxAmount>
    <cac:TaxCategory><cbc:Percent>7</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
  </cac:TaxSubtotal><cac:TaxSubtotal>
    <cbc:TaxableAmount>10.00</cbc:TaxableAmount><cbc:TaxAmount>1.90</cbc:TaxAmount>
    <cac:TaxCategory><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
  </cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:TaxInclusiveAmount currencyID="EUR">118.90</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">18.90</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`
}

export const cii = `<?xml version="1.0"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
 xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
 xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
 <rsm:ExchangedDocument><ram:ID>BEISPIEL-002</ram:ID><ram:TypeCode>381</ram:TypeCode>
  <ram:IssueDateTime><udt:DateTimeString format="102">20261114</udt:DateTimeString></ram:IssueDateTime>
 </rsm:ExchangedDocument>
 <rsm:SupplyChainTradeTransaction>
  <ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>Beispiel-Mühle GmbH</ram:Name>
   <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE000000000</ram:ID></ram:SpecifiedTaxRegistration>
  </ram:SellerTradeParty></ram:ApplicableHeaderTradeAgreement>
  <ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
   <ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode>
    <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${EXAMPLE_IBAN}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
   </ram:SpecifiedTradeSettlementPaymentMeans>
   <ram:ApplicableTradeTax><ram:CalculatedAmount>7.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>
    <ram:BasisAmount>100.00</ram:BasisAmount><ram:RateApplicablePercent>7</ram:RateApplicablePercent>
   </ram:ApplicableTradeTax>
   <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">20261127</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
   <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:GrandTotalAmount>107.00</ram:GrandTotalAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
  </ram:ApplicableHeaderTradeSettlement>
 </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
