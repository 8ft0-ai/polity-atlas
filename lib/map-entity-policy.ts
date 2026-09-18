export type MapEntityKind =
  | 'primary-state'
  | 'dependency'
  | 'overseas-territory'
  | 'disputed-territory'
  | 'other-area';

export type PrimaryMapEntity = {
  id: string;
  iso3: string;
  m49?: string;
  name: string;
  kind: 'primary-state';
};

export type MapEntityDescriptor = {
  id: string;
  name: string;
  kind: MapEntityKind;
  m49?: string;
  iso3?: string;
  parentEntityId?: string;
  associatedPrimaryEntityIds?: string[];
};

export const primaryMapEntities: PrimaryMapEntity[] = [
  { id: 'state:AFG', iso3: 'AFG', m49: '004', name: "Afghanistan", kind: 'primary-state' as const },
  { id: 'state:ALB', iso3: 'ALB', m49: '008', name: "Albania", kind: 'primary-state' as const },
  { id: 'state:DZA', iso3: 'DZA', m49: '012', name: "Algeria", kind: 'primary-state' as const },
  { id: 'state:AND', iso3: 'AND', m49: '020', name: "Andorra", kind: 'primary-state' as const },
  { id: 'state:AGO', iso3: 'AGO', m49: '024', name: "Angola", kind: 'primary-state' as const },
  { id: 'state:ATG', iso3: 'ATG', m49: '028', name: "Antigua and Barbuda", kind: 'primary-state' as const },
  { id: 'state:ARG', iso3: 'ARG', m49: '032', name: "Argentina", kind: 'primary-state' as const },
  { id: 'state:ARM', iso3: 'ARM', m49: '051', name: "Armenia", kind: 'primary-state' as const },
  { id: 'state:AUS', iso3: 'AUS', m49: '036', name: "Australia", kind: 'primary-state' as const },
  { id: 'state:AUT', iso3: 'AUT', m49: '040', name: "Austria", kind: 'primary-state' as const },
  { id: 'state:AZE', iso3: 'AZE', m49: '031', name: "Azerbaijan", kind: 'primary-state' as const },
  { id: 'state:BHS', iso3: 'BHS', m49: '044', name: "Bahamas", kind: 'primary-state' as const },
  { id: 'state:BHR', iso3: 'BHR', m49: '048', name: "Bahrain", kind: 'primary-state' as const },
  { id: 'state:BGD', iso3: 'BGD', m49: '050', name: "Bangladesh", kind: 'primary-state' as const },
  { id: 'state:BRB', iso3: 'BRB', m49: '052', name: "Barbados", kind: 'primary-state' as const },
  { id: 'state:BLR', iso3: 'BLR', m49: '112', name: "Belarus", kind: 'primary-state' as const },
  { id: 'state:BEL', iso3: 'BEL', m49: '056', name: "Belgium", kind: 'primary-state' as const },
  { id: 'state:BLZ', iso3: 'BLZ', m49: '084', name: "Belize", kind: 'primary-state' as const },
  { id: 'state:BEN', iso3: 'BEN', m49: '204', name: "Benin", kind: 'primary-state' as const },
  { id: 'state:BTN', iso3: 'BTN', m49: '064', name: "Bhutan", kind: 'primary-state' as const },
  { id: 'state:BOL', iso3: 'BOL', m49: '068', name: "Bolivia", kind: 'primary-state' as const },
  { id: 'state:BIH', iso3: 'BIH', m49: '070', name: "Bosnia and Herzegovina", kind: 'primary-state' as const },
  { id: 'state:BWA', iso3: 'BWA', m49: '072', name: "Botswana", kind: 'primary-state' as const },
  { id: 'state:BRA', iso3: 'BRA', m49: '076', name: "Brazil", kind: 'primary-state' as const },
  { id: 'state:BRN', iso3: 'BRN', m49: '096', name: "Brunei", kind: 'primary-state' as const },
  { id: 'state:BGR', iso3: 'BGR', m49: '100', name: "Bulgaria", kind: 'primary-state' as const },
  { id: 'state:BFA', iso3: 'BFA', m49: '854', name: "Burkina Faso", kind: 'primary-state' as const },
  { id: 'state:BDI', iso3: 'BDI', m49: '108', name: "Burundi", kind: 'primary-state' as const },
  { id: 'state:CPV', iso3: 'CPV', m49: '132', name: "Cabo Verde", kind: 'primary-state' as const },
  { id: 'state:KHM', iso3: 'KHM', m49: '116', name: "Cambodia", kind: 'primary-state' as const },
  { id: 'state:CMR', iso3: 'CMR', m49: '120', name: "Cameroon", kind: 'primary-state' as const },
  { id: 'state:CAN', iso3: 'CAN', m49: '124', name: "Canada", kind: 'primary-state' as const },
  { id: 'state:CAF', iso3: 'CAF', m49: '140', name: "Central African Republic", kind: 'primary-state' as const },
  { id: 'state:TCD', iso3: 'TCD', m49: '148', name: "Chad", kind: 'primary-state' as const },
  { id: 'state:CHL', iso3: 'CHL', m49: '152', name: "Chile", kind: 'primary-state' as const },
  { id: 'state:CHN', iso3: 'CHN', m49: '156', name: "China", kind: 'primary-state' as const },
  { id: 'state:COL', iso3: 'COL', m49: '170', name: "Colombia", kind: 'primary-state' as const },
  { id: 'state:COM', iso3: 'COM', m49: '174', name: "Comoros", kind: 'primary-state' as const },
  { id: 'state:COG', iso3: 'COG', m49: '178', name: "Republic of the Congo", kind: 'primary-state' as const },
  { id: 'state:CRI', iso3: 'CRI', m49: '188', name: "Costa Rica", kind: 'primary-state' as const },
  { id: 'state:CIV', iso3: 'CIV', m49: '384', name: "Côte d'Ivoire", kind: 'primary-state' as const },
  { id: 'state:HRV', iso3: 'HRV', m49: '191', name: "Croatia", kind: 'primary-state' as const },
  { id: 'state:CUB', iso3: 'CUB', m49: '192', name: "Cuba", kind: 'primary-state' as const },
  { id: 'state:CYP', iso3: 'CYP', m49: '196', name: "Cyprus", kind: 'primary-state' as const },
  { id: 'state:CZE', iso3: 'CZE', m49: '203', name: "Czechia", kind: 'primary-state' as const },
  { id: 'state:PRK', iso3: 'PRK', m49: '408', name: "North Korea", kind: 'primary-state' as const },
  { id: 'state:COD', iso3: 'COD', m49: '180', name: "Democratic Republic of the Congo", kind: 'primary-state' as const },
  { id: 'state:DNK', iso3: 'DNK', m49: '208', name: "Denmark", kind: 'primary-state' as const },
  { id: 'state:DJI', iso3: 'DJI', m49: '262', name: "Djibouti", kind: 'primary-state' as const },
  { id: 'state:DMA', iso3: 'DMA', m49: '212', name: "Dominica", kind: 'primary-state' as const },
  { id: 'state:DOM', iso3: 'DOM', m49: '214', name: "Dominican Republic", kind: 'primary-state' as const },
  { id: 'state:ECU', iso3: 'ECU', m49: '218', name: "Ecuador", kind: 'primary-state' as const },
  { id: 'state:EGY', iso3: 'EGY', m49: '818', name: "Egypt", kind: 'primary-state' as const },
  { id: 'state:SLV', iso3: 'SLV', m49: '222', name: "El Salvador", kind: 'primary-state' as const },
  { id: 'state:GNQ', iso3: 'GNQ', m49: '226', name: "Equatorial Guinea", kind: 'primary-state' as const },
  { id: 'state:ERI', iso3: 'ERI', m49: '232', name: "Eritrea", kind: 'primary-state' as const },
  { id: 'state:EST', iso3: 'EST', m49: '233', name: "Estonia", kind: 'primary-state' as const },
  { id: 'state:SWZ', iso3: 'SWZ', m49: '748', name: "Eswatini", kind: 'primary-state' as const },
  { id: 'state:ETH', iso3: 'ETH', m49: '231', name: "Ethiopia", kind: 'primary-state' as const },
  { id: 'state:FJI', iso3: 'FJI', m49: '242', name: "Fiji", kind: 'primary-state' as const },
  { id: 'state:FIN', iso3: 'FIN', m49: '246', name: "Finland", kind: 'primary-state' as const },
  { id: 'state:FRA', iso3: 'FRA', m49: '250', name: "France", kind: 'primary-state' as const },
  { id: 'state:GAB', iso3: 'GAB', m49: '266', name: "Gabon", kind: 'primary-state' as const },
  { id: 'state:GMB', iso3: 'GMB', m49: '270', name: "Gambia", kind: 'primary-state' as const },
  { id: 'state:GEO', iso3: 'GEO', m49: '268', name: "Georgia", kind: 'primary-state' as const },
  { id: 'state:DEU', iso3: 'DEU', m49: '276', name: "Germany", kind: 'primary-state' as const },
  { id: 'state:GHA', iso3: 'GHA', m49: '288', name: "Ghana", kind: 'primary-state' as const },
  { id: 'state:GRC', iso3: 'GRC', m49: '300', name: "Greece", kind: 'primary-state' as const },
  { id: 'state:GRD', iso3: 'GRD', m49: '308', name: "Grenada", kind: 'primary-state' as const },
  { id: 'state:GTM', iso3: 'GTM', m49: '320', name: "Guatemala", kind: 'primary-state' as const },
  { id: 'state:GIN', iso3: 'GIN', m49: '324', name: "Guinea", kind: 'primary-state' as const },
  { id: 'state:GNB', iso3: 'GNB', m49: '624', name: "Guinea-Bissau", kind: 'primary-state' as const },
  { id: 'state:GUY', iso3: 'GUY', m49: '328', name: "Guyana", kind: 'primary-state' as const },
  { id: 'state:HTI', iso3: 'HTI', m49: '332', name: "Haiti", kind: 'primary-state' as const },
  { id: 'state:HND', iso3: 'HND', m49: '340', name: "Honduras", kind: 'primary-state' as const },
  { id: 'state:HUN', iso3: 'HUN', m49: '348', name: "Hungary", kind: 'primary-state' as const },
  { id: 'state:ISL', iso3: 'ISL', m49: '352', name: "Iceland", kind: 'primary-state' as const },
  { id: 'state:IND', iso3: 'IND', m49: '356', name: "India", kind: 'primary-state' as const },
  { id: 'state:IDN', iso3: 'IDN', m49: '360', name: "Indonesia", kind: 'primary-state' as const },
  { id: 'state:IRN', iso3: 'IRN', m49: '364', name: "Iran", kind: 'primary-state' as const },
  { id: 'state:IRQ', iso3: 'IRQ', m49: '368', name: "Iraq", kind: 'primary-state' as const },
  { id: 'state:IRL', iso3: 'IRL', m49: '372', name: "Ireland", kind: 'primary-state' as const },
  { id: 'state:ISR', iso3: 'ISR', m49: '376', name: "Israel", kind: 'primary-state' as const },
  { id: 'state:ITA', iso3: 'ITA', m49: '380', name: "Italy", kind: 'primary-state' as const },
  { id: 'state:JAM', iso3: 'JAM', m49: '388', name: "Jamaica", kind: 'primary-state' as const },
  { id: 'state:JPN', iso3: 'JPN', m49: '392', name: "Japan", kind: 'primary-state' as const },
  { id: 'state:JOR', iso3: 'JOR', m49: '400', name: "Jordan", kind: 'primary-state' as const },
  { id: 'state:KAZ', iso3: 'KAZ', m49: '398', name: "Kazakhstan", kind: 'primary-state' as const },
  { id: 'state:KEN', iso3: 'KEN', m49: '404', name: "Kenya", kind: 'primary-state' as const },
  { id: 'state:KIR', iso3: 'KIR', m49: '296', name: "Kiribati", kind: 'primary-state' as const },
  { id: 'state:KWT', iso3: 'KWT', m49: '414', name: "Kuwait", kind: 'primary-state' as const },
  { id: 'state:KGZ', iso3: 'KGZ', m49: '417', name: "Kyrgyzstan", kind: 'primary-state' as const },
  { id: 'state:LAO', iso3: 'LAO', m49: '418', name: "Laos", kind: 'primary-state' as const },
  { id: 'state:LVA', iso3: 'LVA', m49: '428', name: "Latvia", kind: 'primary-state' as const },
  { id: 'state:LBN', iso3: 'LBN', m49: '422', name: "Lebanon", kind: 'primary-state' as const },
  { id: 'state:LSO', iso3: 'LSO', m49: '426', name: "Lesotho", kind: 'primary-state' as const },
  { id: 'state:LBR', iso3: 'LBR', m49: '430', name: "Liberia", kind: 'primary-state' as const },
  { id: 'state:LBY', iso3: 'LBY', m49: '434', name: "Libya", kind: 'primary-state' as const },
  { id: 'state:LIE', iso3: 'LIE', m49: '438', name: "Liechtenstein", kind: 'primary-state' as const },
  { id: 'state:LTU', iso3: 'LTU', m49: '440', name: "Lithuania", kind: 'primary-state' as const },
  { id: 'state:LUX', iso3: 'LUX', m49: '442', name: "Luxembourg", kind: 'primary-state' as const },
  { id: 'state:MDG', iso3: 'MDG', m49: '450', name: "Madagascar", kind: 'primary-state' as const },
  { id: 'state:MWI', iso3: 'MWI', m49: '454', name: "Malawi", kind: 'primary-state' as const },
  { id: 'state:MYS', iso3: 'MYS', m49: '458', name: "Malaysia", kind: 'primary-state' as const },
  { id: 'state:MDV', iso3: 'MDV', m49: '462', name: "Maldives", kind: 'primary-state' as const },
  { id: 'state:MLI', iso3: 'MLI', m49: '466', name: "Mali", kind: 'primary-state' as const },
  { id: 'state:MLT', iso3: 'MLT', m49: '470', name: "Malta", kind: 'primary-state' as const },
  { id: 'state:MHL', iso3: 'MHL', m49: '584', name: "Marshall Islands", kind: 'primary-state' as const },
  { id: 'state:MRT', iso3: 'MRT', m49: '478', name: "Mauritania", kind: 'primary-state' as const },
  { id: 'state:MUS', iso3: 'MUS', m49: '480', name: "Mauritius", kind: 'primary-state' as const },
  { id: 'state:MEX', iso3: 'MEX', m49: '484', name: "Mexico", kind: 'primary-state' as const },
  { id: 'state:FSM', iso3: 'FSM', m49: '583', name: "Micronesia", kind: 'primary-state' as const },
  { id: 'state:MCO', iso3: 'MCO', m49: '492', name: "Monaco", kind: 'primary-state' as const },
  { id: 'state:MNG', iso3: 'MNG', m49: '496', name: "Mongolia", kind: 'primary-state' as const },
  { id: 'state:MNE', iso3: 'MNE', m49: '499', name: "Montenegro", kind: 'primary-state' as const },
  { id: 'state:MAR', iso3: 'MAR', m49: '504', name: "Morocco", kind: 'primary-state' as const },
  { id: 'state:MOZ', iso3: 'MOZ', m49: '508', name: "Mozambique", kind: 'primary-state' as const },
  { id: 'state:MMR', iso3: 'MMR', m49: '104', name: "Myanmar", kind: 'primary-state' as const },
  { id: 'state:NAM', iso3: 'NAM', m49: '516', name: "Namibia", kind: 'primary-state' as const },
  { id: 'state:NRU', iso3: 'NRU', m49: '520', name: "Nauru", kind: 'primary-state' as const },
  { id: 'state:NPL', iso3: 'NPL', m49: '524', name: "Nepal", kind: 'primary-state' as const },
  { id: 'state:NLD', iso3: 'NLD', m49: '528', name: "Netherlands", kind: 'primary-state' as const },
  { id: 'state:NZL', iso3: 'NZL', m49: '554', name: "New Zealand", kind: 'primary-state' as const },
  { id: 'state:NIC', iso3: 'NIC', m49: '558', name: "Nicaragua", kind: 'primary-state' as const },
  { id: 'state:NER', iso3: 'NER', m49: '562', name: "Niger", kind: 'primary-state' as const },
  { id: 'state:NGA', iso3: 'NGA', m49: '566', name: "Nigeria", kind: 'primary-state' as const },
  { id: 'state:MKD', iso3: 'MKD', m49: '807', name: "North Macedonia", kind: 'primary-state' as const },
  { id: 'state:NOR', iso3: 'NOR', m49: '578', name: "Norway", kind: 'primary-state' as const },
  { id: 'state:OMN', iso3: 'OMN', m49: '512', name: "Oman", kind: 'primary-state' as const },
  { id: 'state:PAK', iso3: 'PAK', m49: '586', name: "Pakistan", kind: 'primary-state' as const },
  { id: 'state:PLW', iso3: 'PLW', m49: '585', name: "Palau", kind: 'primary-state' as const },
  { id: 'state:PAN', iso3: 'PAN', m49: '591', name: "Panama", kind: 'primary-state' as const },
  { id: 'state:PNG', iso3: 'PNG', m49: '598', name: "Papua New Guinea", kind: 'primary-state' as const },
  { id: 'state:PRY', iso3: 'PRY', m49: '600', name: "Paraguay", kind: 'primary-state' as const },
  { id: 'state:PER', iso3: 'PER', m49: '604', name: "Peru", kind: 'primary-state' as const },
  { id: 'state:PHL', iso3: 'PHL', m49: '608', name: "Philippines", kind: 'primary-state' as const },
  { id: 'state:POL', iso3: 'POL', m49: '616', name: "Poland", kind: 'primary-state' as const },
  { id: 'state:PRT', iso3: 'PRT', m49: '620', name: "Portugal", kind: 'primary-state' as const },
  { id: 'state:QAT', iso3: 'QAT', m49: '634', name: "Qatar", kind: 'primary-state' as const },
  { id: 'state:KOR', iso3: 'KOR', m49: '410', name: "South Korea", kind: 'primary-state' as const },
  { id: 'state:MDA', iso3: 'MDA', m49: '498', name: "Moldova", kind: 'primary-state' as const },
  { id: 'state:ROU', iso3: 'ROU', m49: '642', name: "Romania", kind: 'primary-state' as const },
  { id: 'state:RUS', iso3: 'RUS', m49: '643', name: "Russia", kind: 'primary-state' as const },
  { id: 'state:RWA', iso3: 'RWA', m49: '646', name: "Rwanda", kind: 'primary-state' as const },
  { id: 'state:KNA', iso3: 'KNA', m49: '659', name: "Saint Kitts and Nevis", kind: 'primary-state' as const },
  { id: 'state:LCA', iso3: 'LCA', m49: '662', name: "Saint Lucia", kind: 'primary-state' as const },
  { id: 'state:VCT', iso3: 'VCT', m49: '670', name: "Saint Vincent and the Grenadines", kind: 'primary-state' as const },
  { id: 'state:WSM', iso3: 'WSM', m49: '882', name: "Samoa", kind: 'primary-state' as const },
  { id: 'state:SMR', iso3: 'SMR', m49: '674', name: "San Marino", kind: 'primary-state' as const },
  { id: 'state:STP', iso3: 'STP', m49: '678', name: "Sao Tome and Principe", kind: 'primary-state' as const },
  { id: 'state:SAU', iso3: 'SAU', m49: '682', name: "Saudi Arabia", kind: 'primary-state' as const },
  { id: 'state:SEN', iso3: 'SEN', m49: '686', name: "Senegal", kind: 'primary-state' as const },
  { id: 'state:SRB', iso3: 'SRB', m49: '688', name: "Serbia", kind: 'primary-state' as const },
  { id: 'state:SYC', iso3: 'SYC', m49: '690', name: "Seychelles", kind: 'primary-state' as const },
  { id: 'state:SLE', iso3: 'SLE', m49: '694', name: "Sierra Leone", kind: 'primary-state' as const },
  { id: 'state:SGP', iso3: 'SGP', m49: '702', name: "Singapore", kind: 'primary-state' as const },
  { id: 'state:SVK', iso3: 'SVK', m49: '703', name: "Slovakia", kind: 'primary-state' as const },
  { id: 'state:SVN', iso3: 'SVN', m49: '705', name: "Slovenia", kind: 'primary-state' as const },
  { id: 'state:SLB', iso3: 'SLB', m49: '090', name: "Solomon Islands", kind: 'primary-state' as const },
  { id: 'state:SOM', iso3: 'SOM', m49: '706', name: "Somalia", kind: 'primary-state' as const },
  { id: 'state:ZAF', iso3: 'ZAF', m49: '710', name: "South Africa", kind: 'primary-state' as const },
  { id: 'state:SSD', iso3: 'SSD', m49: '728', name: "South Sudan", kind: 'primary-state' as const },
  { id: 'state:ESP', iso3: 'ESP', m49: '724', name: "Spain", kind: 'primary-state' as const },
  { id: 'state:LKA', iso3: 'LKA', m49: '144', name: "Sri Lanka", kind: 'primary-state' as const },
  { id: 'state:SDN', iso3: 'SDN', m49: '729', name: "Sudan", kind: 'primary-state' as const },
  { id: 'state:SUR', iso3: 'SUR', m49: '740', name: "Suriname", kind: 'primary-state' as const },
  { id: 'state:SWE', iso3: 'SWE', m49: '752', name: "Sweden", kind: 'primary-state' as const },
  { id: 'state:CHE', iso3: 'CHE', m49: '756', name: "Switzerland", kind: 'primary-state' as const },
  { id: 'state:SYR', iso3: 'SYR', m49: '760', name: "Syria", kind: 'primary-state' as const },
  { id: 'state:TJK', iso3: 'TJK', m49: '762', name: "Tajikistan", kind: 'primary-state' as const },
  { id: 'state:THA', iso3: 'THA', m49: '764', name: "Thailand", kind: 'primary-state' as const },
  { id: 'state:TLS', iso3: 'TLS', m49: '626', name: "Timor-Leste", kind: 'primary-state' as const },
  { id: 'state:TGO', iso3: 'TGO', m49: '768', name: "Togo", kind: 'primary-state' as const },
  { id: 'state:TON', iso3: 'TON', m49: '776', name: "Tonga", kind: 'primary-state' as const },
  { id: 'state:TTO', iso3: 'TTO', m49: '780', name: "Trinidad and Tobago", kind: 'primary-state' as const },
  { id: 'state:TUN', iso3: 'TUN', m49: '788', name: "Tunisia", kind: 'primary-state' as const },
  { id: 'state:TUR', iso3: 'TUR', m49: '792', name: "Türkiye", kind: 'primary-state' as const },
  { id: 'state:TKM', iso3: 'TKM', m49: '795', name: "Turkmenistan", kind: 'primary-state' as const },
  { id: 'state:TUV', iso3: 'TUV', m49: '798', name: "Tuvalu", kind: 'primary-state' as const },
  { id: 'state:UGA', iso3: 'UGA', m49: '800', name: "Uganda", kind: 'primary-state' as const },
  { id: 'state:UKR', iso3: 'UKR', m49: '804', name: "Ukraine", kind: 'primary-state' as const },
  { id: 'state:ARE', iso3: 'ARE', m49: '784', name: "United Arab Emirates", kind: 'primary-state' as const },
  { id: 'state:GBR', iso3: 'GBR', m49: '826', name: "United Kingdom", kind: 'primary-state' as const },
  { id: 'state:TZA', iso3: 'TZA', m49: '834', name: "Tanzania", kind: 'primary-state' as const },
  { id: 'state:USA', iso3: 'USA', m49: '840', name: "United States", kind: 'primary-state' as const },
  { id: 'state:URY', iso3: 'URY', m49: '858', name: "Uruguay", kind: 'primary-state' as const },
  { id: 'state:UZB', iso3: 'UZB', m49: '860', name: "Uzbekistan", kind: 'primary-state' as const },
  { id: 'state:VUT', iso3: 'VUT', m49: '548', name: "Vanuatu", kind: 'primary-state' as const },
  { id: 'state:VEN', iso3: 'VEN', m49: '862', name: "Venezuela", kind: 'primary-state' as const },
  { id: 'state:VNM', iso3: 'VNM', m49: '704', name: "Vietnam", kind: 'primary-state' as const },
  { id: 'state:YEM', iso3: 'YEM', m49: '887', name: "Yemen", kind: 'primary-state' as const },
  { id: 'state:ZMB', iso3: 'ZMB', m49: '894', name: "Zambia", kind: 'primary-state' as const },
  { id: 'state:ZWE', iso3: 'ZWE', m49: '716', name: "Zimbabwe", kind: 'primary-state' as const },
  { id: 'state:PSE', iso3: 'PSE', m49: '275', name: "Palestine", kind: 'primary-state' as const },
  { id: 'state:VAT', iso3: 'VAT', m49: '336', name: "Vatican City", kind: 'primary-state' as const },
  { id: 'state:TWN', iso3: 'TWN', m49: '158', name: "Taiwan", kind: 'primary-state' as const },
  { id: 'state:XKX', iso3: 'XKX', name: "Kosovo", kind: 'primary-state' as const },
];

export const primaryM49ToEntity = new Map(
  primaryMapEntities
    .filter((entity) => entity.m49)
    .map((entity) => [entity.m49!, entity]),
);

export const primaryEntityById = new Map(
  primaryMapEntities.map((entity) => [entity.id, entity]),
);

export const primaryCountryOptions = primaryMapEntities
  .map((entity) => ({
    entityId: entity.id,
    m49: entity.m49 ?? entity.iso3,
    name: entity.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const disputedBaseFeatureByName: Record<
  string,
  Omit<MapEntityDescriptor, 'm49' | 'iso3'>
> = {
  Kosovo: {
    id: 'state:XKX',
    name: 'Kosovo',
    kind: 'primary-state',
  },
  'N. Cyprus': {
    id: 'territory:NORTHERN_CYPRUS',
    name: 'Northern Cyprus',
    kind: 'disputed-territory',
    parentEntityId: 'state:CYP',
    associatedPrimaryEntityIds: ['state:CYP'],
  },
  Somaliland: {
    id: 'territory:SOMALILAND',
    name: 'Somaliland',
    kind: 'disputed-territory',
    parentEntityId: 'state:SOM',
    associatedPrimaryEntityIds: ['state:SOM'],
  },
  'W. Sahara': {
    id: 'territory:WESTERN_SAHARA',
    name: 'Western Sahara',
    kind: 'disputed-territory',
    associatedPrimaryEntityIds: ['state:MAR'],
  },
};

const dependencyParentsByM49: Record<string, string> = {
  '016': 'state:USA',
  '060': 'state:GBR',
  '086': 'state:GBR',
  '092': 'state:GBR',
  '136': 'state:GBR',
  '184': 'state:NZL',
  '234': 'state:DNK',
  '238': 'state:GBR',
  '248': 'state:FIN',
  '258': 'state:FRA',
  '260': 'state:FRA',
  '304': 'state:DNK',
  '316': 'state:USA',
  '334': 'state:AUS',
  '344': 'state:CHN',
  '446': 'state:CHN',
  '500': 'state:GBR',
  '531': 'state:NLD',
  '533': 'state:NLD',
  '534': 'state:NLD',
  '540': 'state:FRA',
  '570': 'state:NZL',
  '574': 'state:AUS',
  '580': 'state:USA',
  '612': 'state:GBR',
  '630': 'state:USA',
  '652': 'state:FRA',
  '654': 'state:GBR',
  '660': 'state:GBR',
  '663': 'state:FRA',
  '666': 'state:FRA',
  '744': 'state:NOR',
  '796': 'state:GBR',
  '831': 'state:GBR',
  '832': 'state:GBR',
  '833': 'state:GBR',
  '850': 'state:USA',
  '876': 'state:FRA',
};

const dependencyParentsByName: Record<string, string> = {
  'Indian Ocean Ter.': 'state:AUS',
  'Ashmore and Cartier Is.': 'state:AUS',
};

export function classifyBaseMapFeature(
  m49: string | undefined,
  sourceName: string,
): MapEntityDescriptor {
  const disputed = disputedBaseFeatureByName[sourceName];
  if (disputed) {
    return { ...disputed, m49 };
  }

  if (m49) {
    const primary = primaryM49ToEntity.get(m49);
    if (primary) {
      return {
        id: primary.id,
        name: primary.name,
        kind: primary.kind,
        m49,
        iso3: primary.iso3,
      };
    }
  }

  if (sourceName === 'Antarctica') {
    return {
      id: 'area:ANTARCTICA',
      name: 'Antarctica',
      kind: 'other-area',
      m49,
    };
  }

  const parentEntityId =
    (m49 ? dependencyParentsByM49[m49] : undefined) ??
    dependencyParentsByName[sourceName];

  return {
    id: `territory:${m49 ?? sourceName.toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_')}`,
    name: sourceName,
    kind: 'dependency',
    m49,
    parentEntityId,
    associatedPrimaryEntityIds: parentEntityId ? [parentEntityId] : undefined,
  };
}

export const disputedAreaAssociations: Record<string, string[]> = {
  'N. Cyprus': ['state:CYP'],
  'Northern Cyprus': ['state:CYP'],
  Somaliland: ['state:SOM'],
  Abkhazia: ['state:GEO'],
  'South Ossetia': ['state:GEO'],
  Transnistria: ['state:MDA'],
  'W. Sahara': ['state:MAR'],
  'Western Sahara': ['state:MAR'],
};

export function disputedAreaId(name: string) {
  return `disputed:${name.toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_')}`;
}
