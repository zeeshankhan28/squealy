import React, { Component } from 'react'
import MainComponent from './../Components/MainComponent'
import {
  getEmptyApiDefinition, postApiRequest, getApiRequest, apiCall, formatTestParameters,
  getEmptyUserInfo, getEmptyFilterDefinition
} from './../Utils'
import { DOMAIN_NAME } from './../Constant'
import Loading from 'react-loading'

export default class AuthoringInterfaceContainer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      charts: [],
      selectedChartIndex: null,
      saveInProgress: false,
      savedStatus: true,
      userInfo: getEmptyUserInfo(),
      currentChartMode: null,
      databases: [],
      filters: [],
      selectedFilterIndex: null,
      resultSectionActiveKey: 1,
      isLoading: 0,
      resultLoading: false,
      dataLoading: false,
      visualisationLoading: false
    }
  }

  componentDidMount() {
    if (this.state.selectedChartIndex === null && this.state.selectedFilterIndex === null) {
      this.setState({ selectedChartIndex: 0, selectedFilterIndex: null }, () => {
        getApiRequest(DOMAIN_NAME + 'squealy/charts/', null,
          (response) => { this.setState({isLoading: this.state.isLoading + 1}, () => this.loadInitialCharts(response, 'chart'))},
          (error) => { this.setState({isLoading: this.state.isLoading + 1}), () => this.loadInitialCharts(error, 'chart')}, null)
        getApiRequest(DOMAIN_NAME + 'squealy/user/', null,
          (data) => {
            this.setState({
              userInfo: data,
              isLoading: this.state.isLoading + 1,
            })
          },
          (error) => { this.setState({isLoading: this.state.isLoading + 1}), () => console.error(error)}, null)
        getApiRequest(DOMAIN_NAME + 'squealy/databases/', null,
          (data) => {
            this.setState({
              databases: data.databases,
              isLoading: this.state.isLoading + 1
            })
          },
          (error) => { this.setState({isLoading: this.state.isLoading + 1}), () => console.error(error)}, null)
        getApiRequest(DOMAIN_NAME + 'squealy/filters/', null,
          (response) => { this.setState({isLoading: this.state.isLoading + 1}, () => this.loadInitialCharts(response, 'filter'))},
          (error) => { this.setState({isLoading: this.state.isLoading + 1}), this.loadInitialCharts(error, 'filter')}, null)
      })
    }
  }

  onAPISaved = (response, stateKey, data, callback = null) => {
    this.setState({ 'savedStatus': true, 'saveInProgress': false, [stateKey]: data },
      () => {
        callback && callback.constructor === Function ? callback() : null
      }
    )
  }

  onAPISaveError = (err, callback = null) => {
    this.setState({ 'savedStatus': false, 'saveInProgress': false },
      () => {
        callback && callback.constructor === Function ? callback(err) : null
      })
  }

  saveChart = (charts, chartIndex, onSuccess = null, onFailure = null) => {
    let chart = charts[chartIndex]
    if (chart.id) {
      this.setState({ 'saveInProgress': true },
        postApiRequest(DOMAIN_NAME + 'squealy/charts/', { 'chart': chart },
          (response) => this.onAPISaved(response, 'charts', charts, onSuccess),
          (error) => this.onAPISaveError(error, onFailure), null)
      )
    }
  }

  saveFilter = (filters, index, onSuccess = null, onFailure = null) => {
    let filter = filters[index]
    if (filter.id) {
      this.setState({ 'saveInProgress': true },
        postApiRequest(DOMAIN_NAME + 'squealy/filters/', { 'filter': filter },
          (response) => this.onAPISaved(response, 'filters', filters, onSuccess),
          (error) => this.onAPISaveError(error, onFailure), null)
      )
    }
  }

  // Updates the selected chart index and updates the selected chart name in the URL
  onWidgetDeleted = (index, selectedWidgetIndex, widgetStateKeyData, callback) => {
    const selectedIndex = this.state[selectedWidgetIndex] || index,
      currWidgetData = this.state[widgetStateKeyData]
    let chartMode = false, nonSelectedWidgetIndex = '', type
    if (selectedWidgetIndex === 'selectedChartIndex') {
      type = 'chart'
      nonSelectedWidgetIndex = 'selectedFilterIndex'
    } else {
      type = 'filter'
      nonSelectedWidgetIndex = 'selectedChartIndex'
    }

    if (currWidgetData.length > 1) {
      let widgetData = JSON.parse(JSON.stringify(currWidgetData)),
        newChartIndex = (selectedIndex !== 0) ? selectedIndex - 1 : selectedIndex
      widgetData.splice(index, 1)
      if (newChartIndex && newChartIndex < widgetData.length) {
        chartMode = widgetData[newChartIndex].can_edit || false
      } else {
        chartMode = false
      }
      this.setState({
        [widgetStateKeyData]: widgetData,
        [nonSelectedWidgetIndex]: null,
        [selectedWidgetIndex]: newChartIndex,
        savedStatus: true,
        saveInProgress: false,
        currentChartMode: chartMode
      }, () => {
        callback && callback.constructor === Function && callback()
        this.setUrlPath(type)
      })
    } else {
      this.setState({
        [widgetStateKeyData]: [],
        [selectedWidgetIndex]: null,
        savedStatus: true,
        saveInProgress: false,
        currentChartMode: false,
        [nonSelectedWidgetIndex]: null
      }, () => {
        callback && callback.constructor === Function && callback()
        this.setUrlPath(type)
      })
    }
  }

  // Calls the Delete chart API and triggers onChartDelete function if the API
  // is successfull
  chartDeletionHandler = (index, callback) => {
    const chartId = this.state.charts[index].id
    this.setState({ 'saveInProgress': true },
      apiCall(DOMAIN_NAME + 'charts/', JSON.stringify({ 'id': chartId }), 'DELETE',
        () => this.onWidgetDeleted(index, 'selectedChartIndex', 'charts', callback), this.onAPISaveError, null)
    )
  }

  // Calls the Delete chart API and triggers onChartDelete function if the API
  // is successfull
  filterDeletionHandler = (index, callback) => {
    const filterId = this.state.filters[index].id
    this.setState({ 'saveInProgress': true },
      apiCall(DOMAIN_NAME + 'filters/', JSON.stringify({ 'id': filterId }), 'DELETE',
        () => this.onWidgetDeleted(index, 'selectedFilterIndex', 'filters', callback), this.onAPISaveError, null)
    )
  }


  onNewAPISaved = (newData, id, selectedWidgetIndex, widgetDataKey, onSuccess) => {
    let data = JSON.parse(JSON.stringify(this.state[widgetDataKey]))
    let newIndex = data.push(newData) - 1
    let nonSelectedWidgetIndex, type
    if (selectedWidgetIndex === 'selectedChartIndex') {
      nonSelectedWidgetIndex = 'selectedFilterIndex'
      type = 'chart'
    } else {
      nonSelectedWidgetIndex = 'selectedChartIndex'
      type = 'filter'
    }
    data[newIndex].id = id
    this.setState({
      [widgetDataKey]: data,
      [selectedWidgetIndex]: newIndex,
      [nonSelectedWidgetIndex]: null,
      'savedStatus': true,
      'saveInProgress': false,
	    currentChartMode: newData.can_edit
    }, () => {
      onSuccess && onSuccess.constructor === Function ? onSuccess() : null
      this.setUrlPath(type)
    })
  }

  saveNewChart = (newChart, onSuccess, onFailure) => {
    this.setState({ 'saveInProgress': true },
      postApiRequest(DOMAIN_NAME + 'squealy/charts/', { 'chart': newChart },
        (id) => this.onNewAPISaved(newChart, id, 'selectedChartIndex', 'charts', onSuccess), (err) => this.onAPISaveError(err, onFailure), null)
    )
  }

  saveNewFilter = (newFilter, onSuccess, onFailure) => {
    this.setState({ 'saveInProgress': true },
      postApiRequest(DOMAIN_NAME + 'squealy/filters/', { 'filter': newFilter },
        (id) => this.onNewAPISaved(newFilter, id, 'selectedFilterIndex', 'filters', onSuccess), (err) => this.onAPISaveError(err, onFailure), null)
    )
  }

  loadInitialCharts = (response, type) => {
    //TODO: refactor this function
    let data = [],
      tempData = {},
      selectedStateIndex = type === 'chart' ? 'selectedChartIndex' : 'selectedFilterIndex',
      selectedDataStateKey = type === 'chart' ? 'charts' : 'filters',
      nonSelectedWidgetIndex = type === 'chart' ? 'selectedFilterIndex' : 'selectedChartIndex'
    if (response && response.length !== 0) {
      response.map(obj => {
        tempData = obj
        tempData.testParameters = {}
        data.push(tempData)
      })
      this.setState({ [selectedDataStateKey]: data }, () => {
        const currentPath = window.location.pathname.split('/')
        let selectedIndex = this.state[selectedStateIndex]
        const widgetData = this.state[selectedDataStateKey]

        // If there is a string after / , set the selected chart else set the
        // chart name in the URL
        if (currentPath[1] !== '' && currentPath[1] === type) {
          if (currentPath[2] !== '') {
            const chartInUrl = currentPath[2]
            if (selectedIndex === null || widgetData[selectedIndex].name !== decodeURIComponent(chartInUrl)) {
              let tempIndex = undefined
              widgetData.map((obj, i) => {
                if (obj.name === decodeURIComponent(chartInUrl)) {
                  tempIndex = i
                }
              })
              if (parseInt(tempIndex, 10) >= 0) {
                this.setState({
                  [selectedStateIndex]: tempIndex,
                  [nonSelectedWidgetIndex]: null
                }, () => this.setUrlPath(type))
              } else {
                alert(type + ' not found')
                this.setState({
                  [selectedStateIndex]: 0,
                  [nonSelectedWidgetIndex]: null
                }, () => this.setUrlPath(type))
              }
            } else {
              this.setUrlPath(type)
            }
          } else {
            this.setUrlPath(type)
          }
        } else if ((currentPath.length < 2 || currentPath[1] === '') && type === 'chart') {
          this.setUrlPath('chart')
        }
      })
    }



  }

  // Updates the URL with the selected chart name
  setUrlPath(type) {
    const { selectedChartIndex, charts, currentChartMode, selectedFilterIndex,
      filters} = this.state
    let selectedData = '',
      prefix, accessMode, canEditUrl, newUrl

    if (type === 'filter') {
      selectedData = filters[selectedFilterIndex] || {}
      prefix = 'filter'
    } else {
      selectedData = charts[selectedChartIndex] || {}
      prefix = 'chart'
    }
    //If type is filter and can_edit is false, currentChartMode will be null as View mode is not valid for dropdown filters api.
    accessMode = selectedData.can_edit ? true : (type === 'filter' ? null : false)
    canEditUrl = (accessMode && !window.location.pathname.includes('view')) ? 'edit' : 'view'
    //Only edit mode is valid for dropdown filters api
    canEditUrl = (type === 'filter' || (type === 'chart' && !charts[selectedChartIndex])) ? 'edit' : canEditUrl

    newUrl = '/squealy/' + prefix + '/' + selectedData.name + '/' + canEditUrl + window.location.search
    //currentChartMode will be null for filters to avoid manipulating view by changing url.

    accessMode = (type === 'chart') ?
      (accessMode && !window.location.pathname.includes('view') || false) : accessMode
    this.setState({ currentChartMode: accessMode })
    window.history.replaceState('', '', newUrl);
  }

  // A generic function to handle change in any property inside the selected chart
  selectedChartChangeHandler = (updatedObj, onSuccess = null, index = null, onFailure = null) => {
    let charts = JSON.parse(JSON.stringify(this.state.charts)),
      chartIndex = parseInt(index, 10) //To avoid unexpected errors with value 0
    chartIndex = chartIndex >= 0 ? chartIndex : this.state.selectedChartIndex

    if (updatedObj) {
      Object.keys(updatedObj).map(key => {
        charts[chartIndex][key] = updatedObj[key]
        if (key === 'name') {
          charts[chartIndex].url = updatedObj[key].replace(/ /g, '-').toLowerCase()
        }
      })
    }
    this.saveChart(charts, chartIndex, onSuccess, onFailure)
  }

  //A generic function to handle change in any property inside the selected filter
  selectedFilterChangeHandler = (updatedObj, onSuccess = null, index = null, onFailure = null) => {
    let filters = JSON.parse(JSON.stringify(this.state.filters)),
      filterIndex = parseInt(index, 10) //To avoid unexpected errors with value 0
    filterIndex = filterIndex >= 0 ? filterIndex : this.state.selectedFilterIndex

    if (updatedObj) {
      Object.keys(updatedObj).map(key => {
        filters[filterIndex][key] = updatedObj[key]
        if (key === 'name') {
          filters[filterIndex].url = updatedObj[key].replace(/ /g, '-').toLowerCase()
        }
      })
    }
    this.saveFilter(filters, filterIndex, onSuccess, onFailure)
  }

  // Updates the selected chart's chart data with the result set returned by the
  // query written by the user
  onSuccessTest = (data, callback) => {
    let currentChartData = JSON.parse(JSON.stringify(this.state.charts))
    currentChartData[this.state.selectedChartIndex]['chartData'] = data
    currentChartData[this.state.selectedChartIndex].apiErrorMsg = null
    this.setState({ charts: currentChartData, resultLoading: false, dataLoading: false, visualisationLoading: false }, () => {
      callback ? callback() : null
    })
  }

  onSuccessFilterTest = (data, callback) => {
    let curFilterData = JSON.parse(JSON.stringify(this.state.filters))
    curFilterData[this.state.selectedFilterIndex]['filterData'] = data
    curFilterData[this.state.selectedFilterIndex].apiErrorMsg = null
    this.setState({ filters: curFilterData }, () => {
      callback ? callback() : null
    })
  }

  // Updates the selected chart with the error message recieved from the backend
  onErrorTest = (e) => {
    let charts = JSON.parse(JSON.stringify(this.state.charts))
    charts[this.state.selectedChartIndex].apiErrorMsg = e.responseJSON.error
    this.setState({ charts: charts,  resultLoading: false, dataLoading: false, visualisationLoading: false })
  }

  onErrorFilterTest = (e) => {
    let curFilterData = JSON.parse(JSON.stringify(this.state.filters))
    curFilterData[this.state.selectedFilterIndex].apiErrorMsg = e.responseJSON.error
    this.setState({ filters: curFilterData })
  }

  // Handles click event on run button. This function makes a POST call to get
  // result set of the query written by the user and triggers onSuccessTest if
  // the API is successfull
  onHandleTestButton = (callback=null) => {
    if (this.state.saveInProgress !== true) {
      this.setState({
      resultLoading:true
      })
      const selectedChart = this.state.charts[this.state.selectedChartIndex]
      let payloadObj = formatTestParameters(selectedChart.parameters, 'name', 'test_value')
      if (this.state.resultSectionActiveKey == 1) {
        payloadObj['chartType'] = 'Table'
      }
      postApiRequest(DOMAIN_NAME+'squealy/chart-api/'+selectedChart.url+'/', payloadObj,
                      this.onSuccessTest, this.onErrorTest, callback)
    }
  }

  onResultTabChanged = (key, callback = null) => {
    const selectedChart = this.state.charts[this.state.selectedChartIndex]
    let payloadObj = formatTestParameters(selectedChart.parameters, 'name', 'test_value')
    let tabLoaderActive = 'visualisationLoading'
    if (key === 1) {
      payloadObj['chartType'] = 'Table',
      tabLoaderActive = 'dataLoading'
    }
    this.setState({ resultSectionActiveKey: key, [tabLoaderActive]: true })
    postApiRequest(DOMAIN_NAME + 'squealy/chart-api/' + selectedChart.url + '/', payloadObj,
      this.onSuccessTest, this.onErrorTest, callback)
  }

  onHandleTestFilterButton = (callback = null) => {
    const selectedFilter = this.state.filters[this.state.selectedFilterIndex]
    let payloadObj = formatTestParameters(selectedFilter.parameters, 'name', 'test_value')
    payloadObj.format = 'GoogleChartsFormatter'

    getApiRequest(DOMAIN_NAME+'squealy/filter-api/'+selectedFilter.url+'/', payloadObj,
                    this.onSuccessFilterTest, this.onErrorFilterTest, callback)
  }


  //Appends an empty API definition object to current API Definitions
  chartAdditionHandler = (name, database, onSuccess, onFailure) => {
    let newChart = getEmptyApiDefinition()
    newChart.name = name
    newChart.database = database
    newChart.can_edit = true
    newChart.url = name.replace(/ /g, '-').toLowerCase()

    this.saveNewChart(newChart, onSuccess, onFailure)
  }

  //Appends an empty filter definition object to current filter Definitions
  filterAdditionHandler = (name, database, onSuccess, onFailure) => {
    let newFilter = getEmptyFilterDefinition()
    newFilter.name = name
    newFilter.database = database
    newFilter.can_edit = true
    newFilter.url = name.replace(/ /g, '-').toLowerCase()

    this.saveNewFilter(newFilter, onSuccess, onFailure)
  }

  //Changes the selected API index to the one which was clicked from the API list
  chartSelectionHandler = (index) => {
    window.history.replaceState('', '', window.location.pathname);
    this.setState({
      selectedChartIndex: index,
      selectedFilterIndex: null,
      currentChartMode: this.state.charts[index].can_edit || false},
       () => {
        this.setUrlPath('chart')
        this.onResultTabChanged(1)
        })
  }

  //Changes the selected API index to the one which was clicked from the Filter list
  filterSelectionHandler = (index) => {
    window.history.replaceState('', '', window.location.pathname);
    this.setState({
      selectedFilterIndex: index,
      selectedChartIndex: null,
      currentChartMode: this.state.filters[index].can_edit || null
    }, () => this.setUrlPath('filter'))
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState !== nextProps) {
      return true
    }
  }

  updateViewMode = (val, editPermission, chartMode) => {
    if (editPermission) {
      let selectedIndex, data, type, canEditUrl = ''

      selectedIndex = this.state.selectedChartIndex
      data = this.state.charts
      type = 'chart'

      const newUrl = '/squealy/' + type + '/' + data[selectedIndex].name + '/' + (val ? 'view' : 'edit/')
      window.history.replaceState('', '', newUrl);
      this.setState({ currentChartMode: !val })
    }
  }


  render() {
    const {
      charts,
      selectedChartIndex,
      parameters,
      savedStatus,
      saveInProgress,
      userInfo,
      currentChartMode,
      databases,
      filters,
      selectedFilterIndex,
      resultSectionActiveKey,
      resultLoading,
      dataLoading,
      visualisationLoading
    } = this.state
    const { googleDefined } = this.props

    if (this.state.isLoading <= 3) {
      return (
          <div className='loader'>
            <Loading type='bars' color='#0C8ADC'/>
          </div>
          )
    }

    return (
      <div className="parent-div container-fluid">
        <MainComponent
          userInfo={userInfo}
          charts={charts}
          saveInProgress={saveInProgress}
          savedStatus={savedStatus}
          onHandleTestButton={this.onHandleTestButton}
          selectedChartIndex={selectedChartIndex}
          googleDefined={googleDefined}
          chartAdditionHandler={this.chartAdditionHandler}
          chartSelectionHandler={this.chartSelectionHandler}
          chartDeletionHandler={this.chartDeletionHandler}
          selectedChartChangeHandler={this.selectedChartChangeHandler}
          currentChartMode={currentChartMode}
          updateViewMode={this.updateViewMode}
          databases={databases}
          filters={filters}
          filterAdditionHandler={this.filterAdditionHandler}
          filterDeletionHandler={this.filterDeletionHandler}
          selectedFilterChangeHandler={this.selectedFilterChangeHandler}
          selectedFilterIndex={selectedFilterIndex}
          filterSelectionHandler={this.filterSelectionHandler}
          onHandleTestFilterButton={this.onHandleTestFilterButton}
          onResultTabChanged={this.onResultTabChanged}
          resultSectionActiveKey={resultSectionActiveKey}
          resultLoading={resultLoading}
          dataLoading={dataLoading}
          visualisationLoading={visualisationLoading}
          />
      </div>
    )
  }
}
